import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "../context.js";
import {
  applyTransportStatus,
  attachChildSid,
  attachParentSid,
  findSessionByChildSid,
  findSessionByParentSid,
  getSession,
  hashPayload,
  recordWebhookOnce,
  webhookIdempotencyKey
} from "../calls/ledger.js";
import { isTerminalStatus, parseTwilioCallStatus } from "../calls/state.js";
import { publicUrl } from "./config.js";
import { formParams, verifyTwilioSignature } from "./signature.js";
import { outboundDialTwiml, rejectTwiml } from "./twiml.js";

function xml(reply: FastifyReply, body: string, status = 200) {
  return reply.status(status).type("text/xml").send(body);
}

function requireSignature(ctx: AppContext, request: FastifyRequest, path: string): boolean {
  const token = ctx.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    return false;
  }
  const params = formParams(request.body);
  const signature = request.headers["x-twilio-signature"];
  const header = Array.isArray(signature) ? signature[0] : signature;
  return verifyTwilioSignature(token, header, publicUrl(ctx.env, path), params);
}

export async function registerTwilioWebhooks(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.post("/twilio/voice/outbound", async (request, reply) => {
    if (!requireSignature(ctx, request, "/twilio/voice/outbound")) {
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }
    const params = formParams(request.body);
    const sessionId = params.sessionId;
    if (!sessionId) {
      return xml(reply, rejectTwiml("Missing session"), 400);
    }
    const session = getSession(ctx.db, sessionId);
    if (!session) {
      return xml(reply, rejectTwiml("Unknown session"), 404);
    }
    if (isTerminalStatus(session.status)) {
      return xml(reply, rejectTwiml("Session already completed"), 409);
    }
    const snapshot = JSON.parse(session.lead_snapshot_json) as { phoneE164: string };
    if (!snapshot.phoneE164) {
      return xml(reply, rejectTwiml("No destination"), 400);
    }
    if (params.CallSid) {
      attachParentSid(ctx.db, session.id, params.CallSid);
    }
    applyTransportStatus(ctx.db, session.id, "queued");
    return xml(reply, outboundDialTwiml(ctx.env, snapshot.phoneE164));
  });

  app.post("/twilio/voice/status", async (request, reply) => {
    if (!requireSignature(ctx, request, "/twilio/voice/status")) {
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }
    applyWebhook(ctx, formParams(request.body), "parent");
    return reply.code(204).send();
  });

  app.post("/twilio/voice/number-status", async (request, reply) => {
    if (!requireSignature(ctx, request, "/twilio/voice/number-status")) {
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }
    applyWebhook(ctx, formParams(request.body), "child");
    return reply.code(204).send();
  });
}

function applyWebhook(
  ctx: AppContext,
  params: Record<string, string>,
  kind: "parent" | "child"
): void {
  const rawEvent = params.DialCallStatus || params.CallStatus || "unknown";
  const callSid = params.CallSid || params.DialCallSid || "unknown";
  const next = parseTwilioCallStatus(params.DialCallStatus) ?? parseTwilioCallStatus(params.CallStatus);
  const key = webhookIdempotencyKey(callSid, rawEvent);

  const run = ctx.db.transaction(() => {
    const first = recordWebhookOnce(ctx.db, {
      idempotencyKey: key,
      provider: "twilio",
      eventType: rawEvent,
      payloadHash: hashPayload(params),
      result: next ?? "ignored"
    });
    if (!first) {
      return;
    }

    let session =
      (params.sessionId ? getSession(ctx.db, params.sessionId) : null) ??
      (params.CallSid ? findSessionByParentSid(ctx.db, params.CallSid) : null) ??
      (params.CallSid ? findSessionByChildSid(ctx.db, params.CallSid) : null) ??
      (params.DialCallSid ? findSessionByChildSid(ctx.db, params.DialCallSid) : null) ??
      (params.ParentCallSid ? findSessionByParentSid(ctx.db, params.ParentCallSid) : null);

    if (!session && kind === "parent" && params.CallSid) {
      return;
    }
    if (!session) {
      return;
    }

    if (kind === "parent" && params.CallSid) {
      attachParentSid(ctx.db, session.id, params.CallSid);
    }
    const childSid = params.DialCallSid || (kind === "child" ? params.CallSid : undefined);
    if (childSid) {
      attachChildSid(ctx.db, session.id, childSid);
    }
    if (next) {
      applyTransportStatus(ctx.db, session.id, next);
    }
  });

  run();
}
