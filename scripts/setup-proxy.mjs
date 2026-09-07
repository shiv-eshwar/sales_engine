import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const compose = ["compose", "--env-file", ".env", "-f", "infra/litellm/compose.yaml"];
const docker = args => execFileSync("docker", args, { stdio: "inherit" });
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--from-container")) {
  throw new Error("Usage: npm run proxy:setup -- [--from-container <existing-litellm-container>]");
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
if (args[1]) {
  const directory = mkdtempSync(join(tmpdir(), "sales-proxy-auth-"));
  try {
    const file = join(directory, "auth.json");
    docker(["cp", `${args[1]}:/var/lib/litellm/chatgpt/auth.json`, file]);
    chmodSync(file, 0o600);
    const auth = JSON.parse(readFileSync(file, "utf8"));
    if (!auth.access_token) throw new Error("Source has no usable ChatGPT credentials");
    // Bootstrap with the current access token only. Reusing a rotating refresh
    // token could invalidate the source proxy's login after either one renews.
    delete auth.refresh_token;
    writeFileSync(file, JSON.stringify(auth), { mode: 0o600 });
    docker([...compose, "cp", file, "litellm:/var/lib/litellm/chatgpt/auth.json"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
docker([...compose, "up", "-d", "--wait", "--wait-timeout", "120"]);
console.log(`Sales LiteLLM ready at http://127.0.0.1:${port}. App environment configured; restart the app to apply.`);
console.log("Run npm run proxy:login for an independent renewable ChatGPT session. Imported access tokens are temporary.");
