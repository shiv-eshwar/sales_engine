import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const envFile = process.env.AI_ENV_FILE || ".env";
const compose = ["compose", "--env-file", envFile, "-f", "infra/litellm/compose.yaml"];
const docker = args => execFileSync("docker", args, { stdio: "inherit" });
const args = process.argv.slice(2);
if (args.length) {
  throw new Error("Usage: npm run proxy:setup. Set OPENAI_API_KEY in the private environment file; ChatGPT login and token imports are not used.");
}
let env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.OPENAI_API_KEY?.trim()) {
  throw new Error(`Set OPENAI_API_KEY in ${envFile} before setup. The LiteLLM master key is not an OpenAI API key.`);
}
const existing = env.match(/^SALES_LITELLM_MASTER_KEY=(.+)$/m)?.[1];
const key = existing || `sk-${randomBytes(32).toString("hex")}`;
const port = env.match(/^SALES_LITELLM_PORT=(\d+)$/m)?.[1] || "4001";
const values = {
  SALES_LITELLM_MASTER_KEY: key,
  SALES_LITELLM_PORT: port,
  LLM_BASE_URL: `http://127.0.0.1:${port}/v1`,
  LLM_API_KEY: key,
  LLM_MODEL: "sales-fast",
  LLM_API_MODE: "responses",
  RESEARCH_BASE_URL: `http://127.0.0.1:${port}/v1`,
  RESEARCH_API_KEY: key,
  RESEARCH_MODEL: "sales-research"
};
for (const [name, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : `${env.trimEnd()}\n${name}=${value}\n`;
}
writeFileSync(envFile, env, { mode: 0o600 });
chmodSync(envFile, 0o600);
docker([...compose, "create"]);
docker([...compose, "up", "-d", "--wait", "--wait-timeout", "120"]);
console.log(`Sales LiteLLM process running at http://127.0.0.1:${port}. App environment configured; restart the app to apply.`);
console.log("AI uses OPENAI_API_KEY; no ChatGPT sign-in is needed. Run npm run proxy:check to verify upstream generation.");
