import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadCampaigns } from "./config/campaigns.js";
import { loadPlaybook } from "./config/playbook.js";
import { loadSheetsConfig } from "./config/sheets.js";
import { createOperatorState, type AppContext } from "./context.js";
import type { DeepgramLiveFactory } from "./deepgram/types.js";
import { createDeepgramFactory } from "./deepgram/live.js";
import { CoachEngine } from "./coach/engine.js";
import { createLlmClient } from "./llm/client.js";
import type { LlmClient } from "./llm/types.js";
import { isProduction, loadEnv, type Env } from "./env.js";
import { migrate, openDatabase } from "./db/index.js";
import { registerAuth } from "./auth/routes.js";
import { registerHealth } from "./api/health.js";
import { registerLeads } from "./api/leads.js";
import { registerCallApi } from "./api/calls.js";
import { registerReviewApi } from "./api/review.js";
import { ReviewFinalizer } from "./review/finalize.js";
import { registerTwilioWebhooks } from "./twilio/webhooks.js";
import { registerTwilioMedia } from "./twilio/media.js";
import { LiveEventBus } from "./transcript/events.js";
import { MediaHub } from "./twilio/mediaHub.js";
import { StreamTokenStore } from "./twilio/streamTokens.js";
import formbody from "@fastify/formbody";
import { SheetAdapter } from "./sheets/adapter.js";
import { allowedCountriesFromEnv, createSheetStore } from "./sheets/createStore.js";

export type BuildAppOptions = {
  deepgramFactory?: DeepgramLiveFactory;
  llmClient?: LlmClient | null;
};

export async function buildApp(env: Env = loadEnv(), options: BuildAppOptions = {}) {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
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
  await app.register(formbody);
  await app.register(websocket);

  const dbPath = env.DATABASE_PATH === ":memory:" ? ":memory:" : resolve(env.DATABASE_PATH);
  const db = openDatabase(dbPath);
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

  const streamTokens = new StreamTokenStore();
  const liveEvents = new LiveEventBus();
  const deepgramFactory = options.deepgramFactory ?? createDeepgramFactory(env);
  const llmClient = options.llmClient === undefined ? createLlmClient(env) : options.llmClient;
  const coachEngine = new CoachEngine({
    env,
    db,
    campaigns,
    playbook,
    llm: llmClient,
    liveEvents
  });
  const mediaHub = new MediaHub({
    env,
    db,
    streamTokens,
    liveEvents,
    deepgramFactory,
    onUtterance: (utterance) => coachEngine.consider(utterance)
  });
  const finalizer = adapter
    ? new ReviewFinalizer({
        db,
        campaigns,
        playbook,
        sheetsConfig,
        adapter,
        llm: llmClient,
        coachEngine,
        mediaHub
      })
    : null;

  const ctx: AppContext = {
    env,
    db,
    campaigns,
    playbook,
    sheetsConfig,
    sheetsConfigError,
    adapter,
    sheetMessage,
    operator: createOperatorState(),
    streamTokens,
    liveEvents,
    deepgramFactory,
    mediaHub,
    llmClient,
    coachEngine,
    finalizer
  };

  app.decorate("appContext", ctx);

  await registerHealth(app, ctx);
  await registerAuth(app, ctx);
  await registerLeads(app, ctx);
  await registerCallApi(app, ctx);
  await registerReviewApi(app, ctx);
  await registerTwilioWebhooks(app, ctx);
  await registerTwilioMedia(app, ctx);

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
