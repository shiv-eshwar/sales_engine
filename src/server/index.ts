import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadCampaigns } from "./config/campaigns.js";
import { loadPlaybook } from "./config/playbook.js";
import { loadSheetsConfig } from "./config/sheets.js";
import { createOperatorState, type AppContext } from "./context.js";
import { isProduction, loadEnv } from "./env.js";
import { migrate, openDatabase } from "./db/index.js";
import { registerAuth } from "./auth/routes.js";
import { registerHealth } from "./api/health.js";
import { registerLeads } from "./api/leads.js";
import { SheetAdapter } from "./sheets/adapter.js";
import { allowedCountriesFromEnv, createSheetStore } from "./sheets/createStore.js";

export async function buildApp(env = loadEnv()) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['set-cookie']",
          "*.password",
          "*.apiKey",
          "*.api_key",
          "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
          "*.phone"
        ],
        censor: "[redacted]"
      }
    }
  });

  await app.register(cookie);

  const db = openDatabase(resolve(env.DATABASE_PATH));
  migrate(db, resolve("migrations"));

  let campaigns: AppContext["campaigns"] = [];
  try {
    campaigns = loadCampaigns(resolve(env.CAMPAIGNS_DIR));
  } catch (error) {
    app.log.error({ err: error }, "Failed to load campaigns");
    throw error;
  }

  let playbook = null;
  try {
    playbook = loadPlaybook(resolve(env.PLAYBOOK_PATH));
  } catch (error) {
    app.log.warn({ err: error }, "Playbook failed to load; continuing without it");
  }

  let sheetsConfig = null;
  let sheetsConfigError: string | null = null;
  try {
    sheetsConfig = loadSheetsConfig(resolve(env.SHEETS_CONFIG_PATH));
  } catch (error) {
    sheetsConfigError = error instanceof Error ? error.message : String(error);
  }

  let adapter: SheetAdapter | null = null;
  let sheetMessage = "Sheet backend is unconfigured";
  if (sheetsConfig) {
    const store = createSheetStore(env, sheetsConfig);
    if (store) {
      adapter = new SheetAdapter(store, sheetsConfig, allowedCountriesFromEnv(env), db);
      const preflight = await adapter.preflight();
      sheetMessage = preflight.ok
        ? `Sheet ready (${store.kind})`
        : preflight.errors.join(" ");
    }
  }

  const ctx: AppContext = {
    env,
    db,
    campaigns,
    playbook,
    sheetsConfig,
    sheetsConfigError,
    adapter,
    sheetMessage,
    operator: createOperatorState()
  };

  await registerHealth(app, ctx);
  await registerAuth(app, ctx);
  await registerLeads(app, ctx);

  const clientDir = resolve("dist/client");
  if (isProduction(env) && existsSync(clientDir)) {
    await app.register(fastifyStatic, {
      root: clientDir,
      wildcard: false
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith("/api") || request.raw.url?.startsWith("/health")) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}

async function main() {
  const env = loadEnv();
  const app = await buildApp(env);
  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

const isDirect = process.argv[1]?.includes("src/server/index.ts") || process.argv[1]?.includes("dist/server/index.js");
if (isDirect) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
