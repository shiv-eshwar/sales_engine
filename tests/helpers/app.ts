import { hashPassword } from "../../src/server/auth/password.js";
import { buildApp } from "../../src/server/index.js";
import type { Env } from "../../src/server/env.js";

export const TEST_PASSWORD = "test-password";
export const TEST_AUTH_TOKEN = "test-twilio-auth-token";

export async function makeTestEnv(overrides: Partial<Env> = {}): Promise<Env> {
  return {
    NODE_ENV: "test",
    APP_BASE_URL: "http://127.0.0.1:3000",
    PORT: 3000,
    APP_PASSWORD_HASH: await hashPassword(TEST_PASSWORD),
    SESSION_SECRET: "test-session-secret-32-characters-min",
    DATABASE_PATH: ":memory:",
    SHEETS_CONFIG_PATH: "./config/sheets.example.yaml",
    CAMPAIGNS_DIR: "./config/campaigns",
    PLAYBOOK_PATH: "./config/playbooks/cold-calling.yaml",
    SHEETS_BACKEND: "memory",
    GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: undefined,
    TWILIO_ACCOUNT_SID: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    TWILIO_API_KEY_SID: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    TWILIO_API_KEY_SECRET: "test-api-key-secret",
    TWILIO_AUTH_TOKEN: TEST_AUTH_TOKEN,
    TWILIO_TWIML_APP_SID: "APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    TWILIO_CALLER_ID: "+14155550000",
    TWILIO_ALLOWED_COUNTRIES: "US",
    RECORDING_NOTICE: "Test recording notice. Not legal advice.",
    DEEPGRAM_API_KEY: undefined,
    DEEPGRAM_MODEL: undefined,
    LLM_BASE_URL: undefined,
    LLM_API_KEY: undefined,
    LLM_MODEL: undefined,
    ...overrides
  };
}

export async function startTestApp(overrides: Partial<Env> = {}) {
  const env = await makeTestEnv(overrides);
  const app = await buildApp(env);
  return { app, env };
}

export async function loginCookie(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { password: TEST_PASSWORD }
  });
  const setCookie = response.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) {
    throw new Error(`Login failed: ${response.statusCode} ${response.body}`);
  }
  return raw.split(";")[0] ?? raw;
}
