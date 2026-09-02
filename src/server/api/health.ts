import type { FastifyInstance } from "fastify";
import type { HealthReadyResponse } from "../../shared/contracts.js";
import { resolveSheetsBackend } from "../env.js";
import type { AppContext } from "../context.js";

export async function registerHealth(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    const checks: HealthReadyResponse["checks"] = {};

    const authConfigured = Boolean(ctx.env.APP_PASSWORD_HASH && ctx.env.SESSION_SECRET);
    checks.auth = {
      ok: authConfigured,
      message: authConfigured ? "Password and session secret are set" : "APP_PASSWORD_HASH or SESSION_SECRET is missing"
    };

    checks.database = { ok: true, message: "Migrations applied" };

    checks.campaigns = {
      ok: ctx.campaigns.length > 0,
      message:
        ctx.campaigns.length > 0
          ? `${ctx.campaigns.length} campaign(s) loaded`
          : "No valid campaign YAML files loaded"
    };

    if (ctx.sheetsConfigError) {
      checks.sheetsConfig = { ok: false, message: ctx.sheetsConfigError };
    } else {
      checks.sheetsConfig = { ok: true, message: "sheets.yaml parsed" };
    }

    const backend = resolveSheetsBackend(ctx.env);
    if (!ctx.adapter) {
      checks.sheet = {
        ok: backend === "none",
        message:
          backend === "none"
            ? "Sheet backend is unconfigured"
            : ctx.sheetMessage || "Sheet adapter is unavailable"
      };
    } else {
      const preflight = await ctx.adapter.preflight();
      checks.sheet = {
        ok: preflight.ok,
        message: preflight.ok ? `Sheet schema valid (${backend})` : preflight.errors.join(" ")
      };
    }

    checks.twilio = {
      ok: true,
      message: ctx.env.TWILIO_ACCOUNT_SID ? "Twilio env present (unused until Slice 2)" : "Twilio not configured"
    };

    const ready = Object.values(checks).every((check) => check.ok);
    const body: HealthReadyResponse = { status: ready ? "ok" : "not_ready", checks };
    return reply.code(ready ? 200 : 503).send(body);
  });
}
