import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "../context.js";
import {
  ActiveCallExistsError,
  applyTransportStatus,
  attachChildSid,
  attachParentSid,
  attachRecordingSid,
  createInboundSession,
  findActiveSession,
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
import { busyTwiml, inboundDialTwiml, outboundDialTwiml, rejectTwiml } from "./twiml.js";

function xml(reply: FastifyReply, body: string, status = 200) {
  return reply.status(status).type("text/xml").send(body);
}

function requestParams(request: FastifyRequest): Record<string, string> {
  // Twilio POSTs form bodies; GET (or a misconfigured TwiML App method) carries
  // params in the query string. Merge both so a GET-configured app still works.
  const query = formParams(request.query);
  const body = formParams(request.body);
  return { ...query, ...body };
}

function signatureUrl(ctx: AppContext, request: FastifyRequest, path: string): string {
  // Twilio signs the exact public URL it requested, including any query string.
  const base = publicUrl(ctx.env, path);
  const raw = request.raw.url ?? "";
  const queryIndex = raw.indexOf("?");
  if (queryIndex === -1) {
    return base;
  }
  return `${base}${raw.slice(queryIndex)}`;
}

function requireSignature(ctx: AppContext, request: FastifyRequest, path: string): boolean {
  const token = ctx.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    return false;
  }
  const params = requestParams(request);
  const signature = request.headers["x-twilio-signature"];
  const header = Array.isArray(signature) ? signature[0] : signature;
  return verifyTwilioSignature(token, header, signatureUrl(ctx, request, path), params);
}

export async function registerTwilioWebhooks(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const handleOutbound = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSignature(ctx, request, "/twilio/voice/outbound")) {
      // Twilio plays "application error" for non-2xx/ non-TwiML responses. A 403
      // JSON here is exactly what the caller hears as "an application error has
      // occurred". Log the mismatch (almost always a stale APP_BASE_URL/tunnel
      // or a TwiML App still pointing at an old URL) and still answer with
      // spoken TwiML so the failure is audible instead of generic.
      request.log.warn(
        { url: signatureUrl(ctx, request, "/twilio/voice/outbound") },
        "Twilio outbound signature mismatch; check APP_BASE_URL matches the TwiML App voice URL"
      );
      return xml(reply, rejectTwiml("The call service rejected this request. Please check the server configuration."));
    }
    const params = requestParams(request);
    const sessionId = params.sessionId;
    if (!sessionId) {
      // Always answer 200 + valid TwiML: any 4xx here makes Twilio play its
      // generic "application error" instead of our message.
      request.log.warn({ params: Object.keys(params) }, "Twilio outbound without sessionId");
      return xml(reply, rejectTwiml("Missing session. Please try the call again from the app."));
    }
    const session = getSession(ctx.db, sessionId);
    if (!session) {
      request.log.warn({ sessionId }, "Twilio outbound for unknown session");
      return xml(reply, rejectTwiml("Unknown session. Please try the call again from the app."));
    }
    if (isTerminalStatus(session.status)) {
      request.log.warn({ sessionId, status: session.status }, "Twilio outbound for completed session");
      return xml(reply, rejectTwiml("This call is already completed. Please start a new call from the app."));
    }
    const snapshot = JSON.parse(session.lead_snapshot_json) as { phoneE164: string };
    if (!snapshot.phoneE164) {
      request.log.warn({ sessionId }, "Twilio outbound session has no destination");
      return xml(reply, rejectTwiml("No destination for this call. Please check the lead phone number."));
    }
    if (!ctx.env.TWILIO_CALLER_ID) {
      request.log.warn("Twilio outbound with no TWILIO_CALLER_ID configured");
      return xml(reply, rejectTwiml("The caller ID is not configured. Please contact support."));
    }
    if (params.CallSid) {
      attachParentSid(ctx.db, session.id, params.CallSid);
    }
    applyTransportStatus(ctx.db, session.id, "queued");
    try {
      return xml(reply, outboundDialTwiml(ctx, session.id, snapshot.phoneE164));
    } catch (error) {
      request.log.error({ err: error, sessionId }, "Failed to build outbound TwiML");
      return xml(reply, rejectTwiml("The call service had an error. Please try again."));
    }
  };
  // The TwiML App voice method must be POST, but accept GET too: a TwiML App
  // left on GET otherwise 404s, which Twilio renders as "application error".
  app.get("/twilio/voice/outbound", handleOutbound);
  app.post("/twilio/voice/outbound", handleOutbound);

  app.post("/twilio/voice/status", async (request, reply) => {
    if (!requireSignature(ctx, request, "/twilio/voice/status")) {
      request.log.warn("Twilio status signature mismatch");
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }
    applyWebhook(ctx, requestParams(request), "parent");
    return reply.code(204).send();
  });

  app.post("/twilio/voice/inbound", async (request, reply) => {
    if (!requireSignature(ctx, request, "/twilio/voice/inbound")) {
      request.log.warn("Twilio inbound signature mismatch");
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }
    const params = requestParams(request);
    const from = (params.From || "").trim();
    const callSid = params.CallSid || "";
    if (!from || !callSid) {
      return xml(reply, rejectTwiml("Missing caller information. Please try again."));
    }
    if (findActiveSession(ctx.db)) {
      return xml(reply, busyTwiml());
    }
    let contactName = "Unknown caller";
    let company = "";
    try {
      const lead = await ctx.adapter?.findLeadByPhone(from);
      if (lead) {
        contactName = lead.fullName || "Unknown caller";
        company = lead.company || "";
      }
    } catch {
      // Caller lookup is best-effort; the call still goes through unnamed.
    }
    try {
      const session = createInboundSession(ctx.db, { from, contactName, company, parentSid: callSid });
      return xml(reply, inboundDialTwiml(ctx, session.id, ctx.env.RECORDING_NOTICE));
    } catch (error) {
      if (error instanceof ActiveCallExistsError) {
        return xml(reply, busyTwiml());
      }
      throw error;
    }
  });

  app.post("/twilio/voice/inbound-status", async (request, reply) => {
    if (!requireSignature(ctx, request, "/twilio/voice/inbound-status")) {
      request.log.warn("Twilio inbound-status signature mismatch");
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }
    const params = requestParams(request);
    // Dial action callbacks carry DialCallStatus; Client noun callbacks carry CallStatus.
    applyWebhook(ctx, params, params.DialCallStatus ? "parent" : "child");
    return reply.code(204).send();
  });

  app.post("/twilio/voice/number-status", async (request, reply) => {
    if (!requireSignature(ctx, request, "/twilio/voice/number-status")) {
      request.log.warn("Twilio number-status signature mismatch");
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }
    applyWebhook(ctx, requestParams(request), "child");
    return reply.code(204).send();
  });

  app.post("/twilio/recording/status", async (request, reply) => {
    if (!requireSignature(ctx, request, "/twilio/recording/status")) {
      request.log.warn("Twilio recording-status signature mismatch");
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }
    applyRecordingWebhook(ctx, requestParams(request));
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
      if (kind === "child" && session.twilio_child_sid && session.twilio_child_sid !== childSid) {
        // Simultaneous-ring leg that lost the race: only an answer may steal
        // the tracked leg, otherwise the loser's hangup must not end the call.
        if (next === "in_progress") {
          attachChildSid(ctx.db, session.id, childSid, true);
          applyTransportStatus(ctx.db, session.id, next);
        }
      } else {
        attachChildSid(ctx.db, session.id, childSid);
        // A ringing leg's hangup is ambiguous (loser cancel vs real abandon);
        // the Dial action callback settles the final outcome instead.
        const prematureTerminal =
          kind === "child" && next && isTerminalStatus(next) && session.status !== "in_progress";
        if (next && !prematureTerminal) {
          applyTransportStatus(ctx.db, session.id, next);
        }
      }
    } else if (next) {
      applyTransportStatus(ctx.db, session.id, next);
    }
  });

  run();

  if (ctx.finalizer) {
    const session =
      (params.sessionId ? getSession(ctx.db, params.sessionId) : null) ??
      (params.CallSid ? findSessionByParentSid(ctx.db, params.CallSid) : null) ??
      (params.CallSid ? findSessionByChildSid(ctx.db, params.CallSid) : null) ??
      (params.DialCallSid ? findSessionByChildSid(ctx.db, params.DialCallSid) : null) ??
      (params.ParentCallSid ? findSessionByParentSid(ctx.db, params.ParentCallSid) : null);
    if (session && isTerminalStatus(session.status)) {
      void ctx.finalizer.finalize(session.id).catch(() => undefined);
    }
  }
}

function applyRecordingWebhook(ctx: AppContext, params: Record<string, string>): void {
  const recordingSid = params.RecordingSid;
  const status = params.RecordingStatus || params.RecordingCallStatus || "unknown";
  if (!recordingSid) {
    return;
  }
  const key = webhookIdempotencyKey(recordingSid, status);
  const run = ctx.db.transaction(() => {
    const first = recordWebhookOnce(ctx.db, {
      idempotencyKey: key,
      provider: "twilio",
      eventType: `recording:${status}`,
      payloadHash: hashPayload({
        RecordingSid: recordingSid,
        RecordingStatus: status,
        CallSid: params.CallSid ?? ""
      }),
      result: recordingSid
    });
    if (!first) {
      return;
    }
    const session =
      (params.CallSid ? findSessionByParentSid(ctx.db, params.CallSid) : null) ??
      (params.CallSid ? findSessionByChildSid(ctx.db, params.CallSid) : null) ??
      (params.sessionId ? getSession(ctx.db, params.sessionId) : null);
    if (!session) {
      return;
    }
    attachRecordingSid(ctx.db, session.id, recordingSid);
  });
  run();
}
