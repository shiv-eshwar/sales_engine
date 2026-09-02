import { findActiveSession } from "./calls/ledger.js";
import type { AppContext } from "./context.js";

export async function beginDrain(
  ctx: AppContext,
  options: { timeoutMs?: number } = {}
): Promise<void> {
  ctx.shuttingDown = true;
  ctx.coachEngine.pauseAll();
  const timeoutMs = options.timeoutMs ?? ctx.env.DRAIN_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  while (findActiveSession(ctx.db) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
