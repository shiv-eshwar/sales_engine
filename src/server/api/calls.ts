import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { isAuthenticated, requireSession } from "../auth/routes.js";
import {
  ActiveCallExistsError,
  applyTransportStatus,
  createCallSession,
  findActiveSession,
  getSession,
  publicCallSession,
  type CallSessionRow
} from "../calls/ledger.js";
import { isTerminalStatus } from "../calls/state.js";
import { listUtterances } from "../transcript/utterances.js";
import { twilioVoiceConfigured } from "../twilio/config.js";
import { createVoiceAccessToken } from "../twilio/token.js";

const createSessionSchema = z.object({
  leadId: z.string().min(1),
  campaignId: z.string().min(1)
});

function serializeCall(ctx: AppContext, row: CallSessionRow) {
  return {
    ...publicCallSession(row),
    transcriptionHealth: ctx.mediaHub.getHealth(row.id),
    utterances: listUtterances(ctx.db, row.id)
  };
}

export async function registerCallApi(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };

  app.post("/api/twilio/token", { preHandler: auth }, async (_request, reply) => {
    if (!twilioVoiceConfigured(ctx.env)) {
      return reply.code(503).send({ error: "Twilio Voice is not configured" });
    }
    return { token: createVoiceAccessToken(ctx.env), identity: "operator" };
  });

  app.post("/api/calls/sessions", { preHandler: auth }, async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "leadId and campaignId are required" });
    }
    if (!ctx.adapter) {
      return reply.code(503).send({ error: "Sheet is not configured" });
    }
    const campaign = ctx.campaigns.find((item) => item.id === parsed.data.campaignId);
    if (!campaign) {
      return reply.code(400).send({ error: "Unknown campaign" });
    }
    const lead = await ctx.adapter.findLeadById(parsed.data.leadId);
    if (!lead) {
      return reply.code(404).send({ error: "Lead is not eligible" });
    }
    if (!lead.dialable || !lead.phoneE164) {
      return reply.code(400).send({ error: "Lead phone is not dialable" });
    }
    try {
      const session = createCallSession(ctx.db, {
        leadId: lead.leadId,
        campaignId: campaign.id,
        campaignVersion: campaign.version,
        snapshot: {
          leadId: lead.leadId,
          fullName: lead.fullName,
          phone: lead.phone,
          phoneE164: lead.phoneE164,
          company: lead.company,
          role: lead.role
        }
      });
      return reply.code(201).send(serializeCall(ctx, session));
    } catch (error) {
      if (error instanceof ActiveCallExistsError) {
        return reply.code(409).send({ error: error.message, code: "active_call", sessionId: error.sessionId });
      }
      throw error;
    }
  });

  app.get("/api/calls/active", { preHandler: auth }, async () => {
    const row = findActiveSession(ctx.db);
    return { call: row ? serializeCall(ctx, row) : null };
  });

  app.get("/api/calls/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = getSession(ctx.db, id);
    if (!row) {
      return reply.code(404).send({ error: "Call session not found" });
    }
    return serializeCall(ctx, row);
  });

  app.get("/api/calls/:id/events", { websocket: true }, (socket, request) => {
    if (!isAuthenticated(ctx, request)) {
      socket.close(4401, "Authentication required");
      return;
    }
    const { id } = request.params as { id: string };
    const row = getSession(ctx.db, id);
    if (!row) {
      socket.close(4404, "Call session not found");
      return;
    }
    socket.send(JSON.stringify({ type: "health", status: ctx.mediaHub.getHealth(id) }));
    for (const utterance of listUtterances(ctx.db, id)) {
      socket.send(JSON.stringify({ type: "final", utterance }));
    }
    const unsubscribe = ctx.liveEvents.subscribe(id, (event) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(event));
      }
    });
    socket.on("close", () => {
      unsubscribe();
    });
  });

  app.post("/api/calls/:id/cancel", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = getSession(ctx.db, id);
    if (!row) {
      return reply.code(404).send({ error: "Call session not found" });
    }
    if (!isTerminalStatus(row.status)) {
      applyTransportStatus(ctx.db, id, "canceled");
    }
    const updated = getSession(ctx.db, id);
    return updated ? serializeCall(ctx, updated) : reply.code(404).send({ error: "Call session not found" });
  });
}
