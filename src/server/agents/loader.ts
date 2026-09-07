import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Eve-framework agents live in reviewable directories at the repo root:
// agents/<name>/agent.ts (defineAgent: description, model, outputSchema)
// agents/<name>/instructions.md (static system prompt with a {{SCHEMA}} slot).
// The local runner keeps the existing OpenAI-compatible LLM transport
// (chat_completions/responses modes, timeouts, fake injection for tests), so
// latency budgets, validators, and holdout behavior are unchanged.
const AGENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "agents");

export type AgentName = "live-coach" | "post-call" | "campaign-generation" | "prospect-research";

const SEPARATORS: Record<AgentName, " " | "\n"> = {
  "live-coach": " ",
  "post-call": " ",
  "campaign-generation": "\n",
  "prospect-research": "\n"
};

const SCHEMA_SLOT = "{{SCHEMA}}";

function readInstructions(name: AgentName): string[] {
  const raw = readFileSync(join(AGENTS_DIR, name, "instructions.md"), "utf8").trim();
  const lines = raw.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  if (!lines.includes(SCHEMA_SLOT)) {
    throw new Error(`Agent ${name} instructions are missing the ${SCHEMA_SLOT} slot.`);
  }
  return lines;
}

// Renders the agent's static instructions with its JSON-schema line slotted
// in. Callers append dynamic context (campaign rules, playbook) after this,
// exactly as before.
export function renderAgentSystem(name: AgentName, schemaLine: string): string {
  return readInstructions(name).join(SEPARATORS[name]).replace(SCHEMA_SLOT, schemaLine);
}
