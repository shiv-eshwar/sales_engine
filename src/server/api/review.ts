import type { FastifyInstance } from "fastify";
import {
  approveProposalRequestSchema,
  discardProposalRequestSchema,
  reviewInterviewRequestSchema,
  summaryQuerySchema
} from "../../shared/schemas.js";
import type { AppContext } from "../context.js";
import { requireSession } from "../auth/routes.js";
import { getSession } from "../calls/ledger.js";
import { isTerminalStatus } from "../calls/state.js";
import { getProposalBySession, findPendingProposal } from "../review/store.js";
import { approveProposal, discardProposal, retryProcessing, skipNonConnect, ReviewError } from "../review/actions.js";
import {
  applyReviewInterviewAction,
  bootstrapReviewReply,
  interviewReviewTurn,
  isBootstrapTurn,
  resolveReviewTurn
} from "../review/interview.js";
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

  app.post("/api/calls/:id/review/interview", { preHandler: auth }, async (request, reply) => {
    if (!ctx.finalizer) {
      return reply.code(503).send({ error: "Sheet is not configured" });
    }
    const parsed = reviewInterviewRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Send the review conversation so far." });
    }
    const { id } = request.params as { id: string };
    const row = getProposalBySession(ctx.db, id);
    if (!row || row.status === "processing") {
      return reply.code(404).send({ error: "Proposal is not ready" });
    }
    const proposal = ctx.finalizer.present(row);
    if (isBootstrapTurn(parsed.data.messages, parsed.data.bootstrap)) {
      return bootstrapReviewReply(proposal);
    }
    const intent = resolveReviewTurn(parsed.data.messages, proposal);
    if (intent) {
      try {
        return await applyReviewInterviewAction(ctx, proposal, intent.action, intent.fields, intent.message);
      } catch (error) {
        return sendReviewError(reply, error);
      }
    }
    if (!ctx.llmClient) {
      return reply.code(503).send({ error: "Configure the LLM connection before chatting about this review." });
    }
    if (ctx.shuttingDown) {
      return reply.code(503).send({ error: "Server is restarting. Try again shortly." });
    }
    try {
      const turn = await interviewReviewTurn(
        ctx.llmClient,
        parsed.data.messages,
        proposal,
        ctx.env.AI_GENERATION_TIMEOUT_MS
      );
      const latest = ctx.finalizer.present(getProposalBySession(ctx.db, id) ?? row);
      return await applyReviewInterviewAction(ctx, latest, turn.action, turn.fields, turn.message);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AI generation failed")) {
        return reply.code(502).send({ error: error.message });
      }
      return sendReviewError(reply, error);
    }
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

  app.get("/api/summary", { preHandler: auth }, async (request, reply) => {
    const parsed = summaryQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Summary date must be YYYY-MM-DD" });
    }
    return buildDailySummary(ctx.db, ctx.playbook, parsed.data.date, parsed.data.campaignId);
  });
}
