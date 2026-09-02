import { existsSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  APP_BASE_URL: z.string().default("http://127.0.0.1:5173"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_PASSWORD_HASH: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  DATABASE_PATH: z.string().default("./data/ledger.sqlite"),
  SHEETS_CONFIG_PATH: z.string().default("./config/sheets.example.yaml"),
  CAMPAIGNS_DIR: z.string().default("./config/campaigns"),
  PLAYBOOK_PATH: z.string().default("./config/playbooks/cold-calling.yaml"),
  SHEETS_BACKEND: z.enum(["google", "memory", "none"]).optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_TWIML_APP_SID: z.string().optional(),
  TWILIO_CALLER_ID: z.string().optional(),
  TWILIO_ALLOWED_COUNTRIES: z.string().default("US"),
  RECORDING_NOTICE: z
    .string()
    .default(
      "Recording and transcription may be active. Give any required notice before substantive conversation. This app does not guarantee legal compliance."
    ),
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_MODEL: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(path = ".env"): Env {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
  return envSchema.parse(process.env);
}

export function isProduction(env: Env): boolean {
  return env.NODE_ENV === "production";
}

export function cookieSecure(env: Env): boolean {
  return env.APP_BASE_URL.startsWith("https://");
}

export function resolveSheetsBackend(env: Env): "google" | "memory" | "none" {
  if (env.SHEETS_BACKEND) {
    return env.SHEETS_BACKEND;
  }
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 && env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64.trim() !== "") {
    return "google";
  }
  if (env.NODE_ENV === "production") {
    return "none";
  }
  return "memory";
}
