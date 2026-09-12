import { expect } from "vitest";
import { applyTransportStatus } from "../../src/server/calls/ledger.js";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";
import {
  extractStreamToken,
  getAppContext,
  loginCookie,
  startTestApp,
  TEST_AUTH_TOKEN
} from "./app.js";
import { createFakeDeepgramFactory, type FakeDeepgramConnection } from "./deepgram.js";
import { FakeLlmClient } from "./llm.js";
import type { Env } from "../../src/server/env.js";
import type { BuildAppOptions } from "../../src/server/index.js";

export function signedForm(path: string, params: Record<string, string>) {
  const url = `http://127.0.0.1:3000${path}`;
  return {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": expectedTwilioSignature(TEST_AUTH_TOKEN, url, params)
    },
    payload: new URLSearchParams(params).toString()
  };
}

export type StartedCall = {
  app: Awaited<ReturnType<typeof startTestApp>>["app"];
  cookie: string;
  ctx: ReturnType<typeof getAppContext>;
  sessionId: string;
  parentSid: string;
  fakes: FakeDeepgramConnection[];
  outbound: FakeDeepgramConnection | undefined;
  inbound: FakeDeepgramConnection | undefined;
  twiml: string;
  llm: FakeLlmClient;
};

export async function startConnectedCall(input: {
  llm?: FakeLlmClient;
  leadId?: string;
  campaignId?: string;
  connected?: boolean;
  media?: boolean;
  env?: Partial<Env>;
  options?: BuildAppOptions;
} = {}): Promise<StartedCall> {
  const llm = input.llm ?? new FakeLlmClient();
  const fakes: FakeDeepgramConnection[] = [];
  const { app } = await startTestApp(input.env ?? {}, {
    deepgramFactory: createFakeDeepgramFactory(fakes),
    llmClient: llm,
    ...input.options
  });
  const cookie = await loginCookie(app);
  const leadId = input.leadId ?? "L-100";
  const campaignId = input.campaignId ?? "lamina-sales";
  const created = await app.inject({
    method: "POST",
    url: "/api/calls/sessions",
    headers: { cookie },
    payload: { leadId, campaignId }
  });
  expect(created.statusCode).toBe(201);
  const sessionId = (created.json() as { id: string }).id;
  const parentSid = `CA${sessionId.replaceAll("-", "").slice(0, 32)}`;
  const twiml = await app.inject({
    method: "POST",
    url: "/twilio/voice/outbound",
    ...signedForm("/twilio/voice/outbound", {
      sessionId,
      CallSid: parentSid,
      CallStatus: "queued"
    })
  });
  const ctx = getAppContext(app);
  const media = input.media !== false;
  if (media) {
    const socket = ctx.mediaHub.createSocket();
    socket.handle({
      event: "start",
      start: {
        tracks: ["inbound", "outbound"],
        customParameters: { streamToken: extractStreamToken(twiml.body), sessionId }
      }
    });
  }
  if (input.connected !== false) {
    applyTransportStatus(ctx.db, sessionId, "in_progress");
  }
  return {
    app,
    cookie,
    ctx,
    sessionId,
    parentSid,
    fakes,
    outbound: fakes.find((item) => item.speaker === "contact") ?? fakes[1],
    inbound: fakes.find((item) => item.speaker === "caller") ?? fakes[0],
    twiml: twiml.body,
    llm
  };
}

export async function postStatus(
  app: StartedCall["app"],
  params: Record<string, string>
) {
  return app.inject({
    method: "POST",
    url: "/twilio/voice/status",
    ...signedForm("/twilio/voice/status", params)
  });
}

export async function postRecording(
  app: StartedCall["app"],
  params: Record<string, string>
) {
  return app.inject({
    method: "POST",
    url: "/twilio/recording/status",
    ...signedForm("/twilio/recording/status", params)
  });
}

export const yesCriteria = {
  relevant_problem: { state: "yes" as const, evidence: "painful weekly regressions", confidence: 0.9 },
  meaningful_cost: { state: "yes" as const, evidence: "cost the team two days", confidence: 0.9 },
  influence: { state: "yes" as const, evidence: "I decide what we try next", confidence: 0.9 },
  timing: { state: "yes" as const, evidence: "we want to look this quarter", confidence: 0.8 }
};
