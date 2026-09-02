import { describe, expect, it } from "vitest";
import { getSession } from "../../src/server/calls/ledger.js";
import { beginDrain } from "../../src/server/shutdown.js";
import { getAppContext, loginCookie, startTestApp } from "../helpers/app.js";

describe("SIGTERM drain", () => {
  it("rejects new sessions and does not hang up an active call", async () => {
    const { app } = await startTestApp();
    const cookie = await loginCookie(app);
    const ctx = getAppContext(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-100", campaignId: "lamina-sales" }
    });
    expect(created.statusCode).toBe(201);
    const sessionId = (created.json() as { id: string }).id;

    await beginDrain(ctx, { timeoutMs: 120 });

    const second = await app.inject({
      method: "POST",
      url: "/api/calls/sessions",
      headers: { cookie },
      payload: { leadId: "L-101", campaignId: "lamina-sales" }
    });
    expect(second.statusCode).toBe(503);
    expect((second.json() as { code: string }).code).toBe("draining");
    expect(getSession(ctx.db, sessionId)?.status).toBe("created");
    await app.close();
  });
});
