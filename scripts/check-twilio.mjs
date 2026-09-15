// Read-only by default. --sync explicitly updates this TwiML application's URLs.
// Never creates calls or changes account/phone-number permissions.
import { existsSync } from "node:fs";
const envFile = process.env.TWILIO_ENV_FILE || ".env";
if (existsSync(envFile)) process.loadEnvFile(envFile);
const env = process.env;
for (const key of ["APP_BASE_URL", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET", "TWILIO_TWIML_APP_SID", "TWILIO_CALLER_ID"]) {
  if (!env[key]) throw new Error(`${key} is missing`);
}
const publicBase = new URL(env.APP_BASE_URL);
if (publicBase.protocol !== "https:" || publicBase.username || publicBase.password || publicBase.search || publicBase.hash) {
  throw new Error("APP_BASE_URL must be a public HTTPS URL without credentials, query or fragment");
}
const base = env.APP_BASE_URL.replace(/\/$/, "");
const api = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}`;
async function request(url, key = env.TWILIO_ACCOUNT_SID, secret = env.TWILIO_AUTH_TOKEN, body) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? new URLSearchParams(body) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Twilio configuration check failed: HTTP ${response.status}`);
  return response.json();
}
try {
  const account = await request(`${api}.json`);
  if (account.status !== "active") throw new Error("Twilio account is not active");
  const appUrl = `${api}/Applications/${env.TWILIO_TWIML_APP_SID}.json`;
  await request(appUrl, env.TWILIO_API_KEY_SID, env.TWILIO_API_KEY_SECRET);
  const phoneQuery = new URLSearchParams({ PhoneNumber: env.TWILIO_CALLER_ID });
  const numbers = await request(`${api}/IncomingPhoneNumbers.json?${phoneQuery}`);
  if (!numbers.incoming_phone_numbers.some(n => n.phone_number === env.TWILIO_CALLER_ID && n.capabilities.voice)) {
    throw new Error("Configured caller number was not found as a voice-capable number on this account");
  }
  const health = await fetch(`${base}/health/live`, { signal: AbortSignal.timeout(15000) });
  if (!health.ok || (await health.json()).status !== "ok") throw new Error("Public application health check failed");
  if (process.argv.includes("--sync")) {
    await request(appUrl, env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, {
      VoiceUrl: `${base}/twilio/voice/outbound`, VoiceMethod: "POST",
      StatusCallback: `${base}/twilio/voice/status`, StatusCallbackMethod: "POST"
    });
  }
  const app = await request(appUrl);
  if (app.voice_url !== `${base}/twilio/voice/outbound` || app.voice_method !== "POST" ||
      app.status_callback !== `${base}/twilio/voice/status` || app.status_callback_method !== "POST") {
    throw new Error("TwiML application URLs/methods do not match APP_BASE_URL. Review the target deployment, then run with --sync to align them.");
  }
  console.log("PASS: active account, both credential pairs, caller number, public HTTPS health and TwiML URLs/methods");
  if (publicBase.hostname.endsWith(".trycloudflare.com")) {
    console.log("Temporary tunnel: a tunnel restart can change this hostname. Recheck configuration after any tunnel restart; use a stable hostname for production.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Twilio configuration check failed");
  process.exitCode = 1;
}
