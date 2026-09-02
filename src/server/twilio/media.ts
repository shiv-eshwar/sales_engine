import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";

export async function registerTwilioMedia(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.get("/twilio/media", { websocket: true }, (socket) => {
    const session = ctx.mediaHub.createSocket();
    socket.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const decision = session.handle(parsed);
      if (decision.action === "close") {
        socket.close(decision.code, decision.reason);
      }
    });
    socket.on("close", () => {
      void session.stop().catch(() => undefined);
    });
  });
}
