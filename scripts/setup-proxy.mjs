import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const compose = ["compose", "--env-file", ".env", "-f", "infra/litellm/compose.yaml"];
const docker = args => execFileSync("docker", args, { stdio: "inherit" });
const args = process.argv.slice(2);
if (args.length) {
  throw new Error("Temporary token imports are no longer supported: they cannot renew after expiry or revocation. Run npm run proxy:setup, then npm run proxy:login for this proxy's own renewable session.");
}
let env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
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
writeFileSync(".env", env, { mode: 0o600 });
chmodSync(".env", 0o600);
docker([...compose, "create"]);
docker([...compose, "up", "-d", "--wait", "--wait-timeout", "120"]);
console.log(`Sales LiteLLM process running at http://127.0.0.1:${port}. App environment configured; restart the app to apply.`);
console.log("AI generation is not verified yet. Run npm run proxy:login for an independent renewable ChatGPT session and a real generation check.");
