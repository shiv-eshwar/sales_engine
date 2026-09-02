import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import WebSocket from "ws";
import { expectedTwilioSignature } from "../../src/server/twilio/signature.js";
import { extractStreamToken, startTestApp, TEST_AUTH_TOKEN, TEST_PASSWORD } from "../helpers/app.js";
import { createFakeDeepgramFactory, type FakeDeepgramConnection } from "../helpers/deepgram.js";
import { coachOutput, FakeLlmClient, postCallOutput } from "../helpers/llm.js";

export { TEST_PASSWORD };

export type E2eServer = {
  baseURL: string;
  fakes: FakeDeepgramConnection[];
  llm: FakeLlmClient;
  close: () => Promise<void>;
  cookieHeader: (page: Page) => Promise<string>;
  signedPost: (path: string, params: Record<string, string>) => Promise<Response>;
  activeSession: (page: Page) => Promise<{ id: string; status: string }>;
  startMedia: (page: Page) => Promise<{ socket: WebSocket; sessionId: string; parentSid: string }>;
  waitForFakes: (count: number) => Promise<FakeDeepgramConnection[]>;
};

export function parentSidFor(sessionId: string): string {
  return `CA${sessionId.replaceAll("-", "").padEnd(32, "0").slice(0, 32)}`;
}

function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not bind an ephemeral port"));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolvePort(port);
        }
      });
    });
  });
}

function enqueueDefaultLlm(llm: FakeLlmClient): void {
  llm.enqueueJson(
    coachOutput({
      basedOnSequence: 1,
      cueType: "question",
      cue: "How do you currently verify user-facing behavior?"
    })
  );
  llm.enqueueJson(
    coachOutput({
      basedOnSequence: 3,
      cueType: "question",
      cue: "What does a miss cost in a typical week?"
    })
  );
  llm.enqueueJson(
    postCallOutput({
      semanticOutcome: "permission_to_follow_up",
      qualification: "unknown",
      criteria: {
        relevant_problem: {
          state: "yes",
          evidence: "we currently verify user-facing behavior by hand",
          confidence: 0.8
        },
        meaningful_cost: { state: "unknown", evidence: null, confidence: 0 },
        influence: { state: "unknown", evidence: null, confidence: 0 },
        timing: { state: "unknown", evidence: null, confidence: 0 }
      }
    })
  );
}

export async function startE2eServer(options: { sheetsConfigPath?: string; enqueueLlm?: boolean } = {}): Promise<E2eServer> {
  const clientDir = resolve("dist/client");
  if (!existsSync(clientDir)) {
    throw new Error("dist/client is missing. Run VITE_E2E=true npm run build before Playwright.");
  }

  const port = await getFreePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const fakes: FakeDeepgramConnection[] = [];
  const llm = new FakeLlmClient();
  if (options.enqueueLlm !== false) {
    enqueueDefaultLlm(llm);
  }

  const { app } = await startTestApp(
    {
      NODE_ENV: "production",
      PORT: port,
      APP_BASE_URL: baseURL,
      SHEETS_CONFIG_PATH: options.sheetsConfigPath ?? "./config/sheets.example.yaml"
    },
    {
      deepgramFactory: createFakeDeepgramFactory(fakes),
      llmClient: llm,
      disableLogger: true
    }
  );

  await app.listen({ host: "127.0.0.1", port });
  const mediaSockets: WebSocket[] = [];

  async function cookieHeader(page: Page): Promise<string> {
    const cookies = await page.context().cookies();
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  }

  async function signedPost(path: string, params: Record<string, string>): Promise<Response> {
    const url = `${baseURL}${path}`;
    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": expectedTwilioSignature(TEST_AUTH_TOKEN, url, params)
      },
      body: new URLSearchParams(params).toString()
    });
  }

  async function activeSession(page: Page): Promise<{ id: string; status: string }> {
    const cookie = await cookieHeader(page);
    const response = await fetch(`${baseURL}/api/calls/active`, { headers: { cookie } });
    if (!response.ok) {
      throw new Error(`active session ${response.status}`);
    }
    const body = (await response.json()) as { call: { id: string; status: string } | null };
    if (!body.call) {
      throw new Error("No active call session");
    }
    return body.call;
  }

  async function startMedia(page: Page): Promise<{ socket: WebSocket; sessionId: string; parentSid: string }> {
    const session = await activeSession(page);
    const parentSid = parentSidFor(session.id);
    const twimlResponse = await signedPost("/twilio/voice/outbound", {
      sessionId: session.id,
      CallSid: parentSid,
      CallStatus: "queued"
    });
    const twiml = await twimlResponse.text();
    const token = extractStreamToken(twiml);
    const wsUrl = `${baseURL.replace(/^http/, "ws")}/twilio/media`;
    const socket = await new Promise<WebSocket>((resolveSocket, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            event: "start",
            start: {
              tracks: ["inbound", "outbound"],
              customParameters: { streamToken: token, sessionId: session.id }
            }
          })
        );
        resolveSocket(ws);
      });
      ws.on("error", reject);
    });
    mediaSockets.push(socket);
    return { socket, sessionId: session.id, parentSid };
  }

  async function waitForFakes(count: number): Promise<FakeDeepgramConnection[]> {
    const deadline = Date.now() + 5000;
    while (fakes.length < count && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    }
    if (fakes.length < count) {
      throw new Error(`Expected ${count} Deepgram fakes, got ${fakes.length}`);
    }
    return fakes;
  }

  return {
    baseURL,
    fakes,
    llm,
    cookieHeader,
    signedPost,
    activeSession,
    startMedia,
    waitForFakes,
    close: async () => {
      for (const socket of mediaSockets) {
        socket.close();
      }
      await app.close();
    }
  };
}
