import type { FastifyInstance } from "fastify";
import {
  approveProposalRequestSchema,
  discardProposalRequestSchema
} from "../../shared/schemas.js";
import type { AppContext } from "../context.js";
import { requireSession } from "../auth/routes.js";
import { getSession } from "../calls/ledger.js";
import { isTerminalStatus } from "../calls/state.js";
import { getProposalBySession, findPendingProposal } from "../review/store.js";
import { approveProposal, discardProposal, retryProcessing, skipNonConnect, ReviewError } from "../review/actions.js";
import { buildDailySummary } from "../review/summary.js";

function sendReviewError(reply: import("fastify").FastifyReply, error: unknown) {
  if (error instanceof ReviewError) {
    return reply.code(error.http).send({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : "Review failed";
  return reply.code(400).send({ error: message });
}

export async function registerReviewApi(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const auth = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    await requireSession(ctx, request, reply);
  };

  app.post("/api/calls/:id/finalize", { preHandler: auth }, async (request, reply) => {
    if (!ctx.finalizer) {
      return reply.code(503).send({ error: "Sheet is not configured" });
    }
    const { id } = request.params as { id: string };
    const session = getSession(ctx.db, id);
    if (!session) {
      return reply.code(404).send({ error: "Call session not found" });
    }
    if (!isTerminalStatus(session.status)) {
      return reply.code(409).send({ error: "Call is still active" });
    }
    try {
      return await ctx.finalizer.finalize(id);
    } catch (error) {
      return sendReviewError(reply, error);
    }
  });

  app.get("/api/calls/:id/proposal", { preHandler: auth }, async (request, reply) => {
    if (!ctx.finalizer) {
      return reply.code(503).send({ error: "Sheet is not configured" });
    }
    const { id } = request.params as { id: string };
    const row = getProposalBySession(ctx.db, id);
    if (!row || row.status === "processing") {
      return reply.code(404).send({ error: "Proposal is not ready" });
    }
    return ctx.finalizer.present(row);
  });

  app.get("/api/proposals/pending", { preHandler: auth }, async (_request, reply) => {
    if (!ctx.finalizer) {
      return reply.code(503).send({ error: "Sheet is not configured" });
    }
    const row = findPendingProposal(ctx.db);
    if (!row || row.status === "processing") {
      return { proposal: null };
    }
    return { proposal: ctx.finalizer.present(row) };
  });

  app.post("/api/proposals/:id/approve", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = approveProposalRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid proposal edits" });
    }
    try {
      return await approveProposal(ctx, id, parsed.data.fields);
    } catch (error) {
      return sendReviewError(reply, error);
    }
  });

  app.post("/api/proposals/:id/retry-write", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await approveProposal(ctx, id, undefined);
    } catch (error) {
      return sendReviewError(reply, error);
    }
  });

  app.post("/api/proposals/:id/skip", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await skipNonConnect(ctx, id);
    } catch (error) {
      return sendReviewError(reply, error);
    }
  });

  app.post("/api/proposals/:id/retry-processing", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await retryProcessing(ctx, id);
    } catch (error) {
      return sendReviewError(reply, error);
    }
  });

  app.post("/api/proposals/:id/discard", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = discardProposalRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Discard requires confirmation" });
    }
    try {
      const proposal = await discardProposal(ctx, id);
      return { proposal };
    } catch (error) {
      return sendReviewError(reply, error);
    }
  });

  app.get("/api/summary", { preHandler: auth }, async () => {
    return buildDailySummary(ctx.db, ctx.playbook, ctx.campaigns);
  });
}
