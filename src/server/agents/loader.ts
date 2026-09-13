import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

// Eve-framework agents live in reviewable directories at the repo root:
// agents/<name>/agent.ts, instructions.md, and optional skills/<pack>/SKILL.md.
// The local runner keeps the existing OpenAI-compatible LLM transport.
const AGENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "agents");

export type AgentName =
  | "live-coach"
  | "post-call"
  | "campaign-generation"
  | "campaign-interview"
  | "prospect-research"
  | "call-review";

const SCHEMA_SLOT = "{{SCHEMA}}";

type SkillPack = {
  name: string;
  description: string;
  cheatsheet: string | null;
};

function parseFrontmatter(raw: string): { name?: string; description?: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const yamlBlock = match?.[1];
  if (!yamlBlock) return {};
  const parsed = parseYaml(yamlBlock);
  if (!parsed || typeof parsed !== "object") return {};
  const record = parsed as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name.trim() : undefined,
    description: typeof record.description === "string" ? record.description.trim() : undefined
  };
}

export function listAgentSkills(name: AgentName): SkillPack[] {
  const skillsDir = join(AGENTS_DIR, name, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const packDir = join(skillsDir, entry.name);
      const skillPath = join(packDir, "SKILL.md");
      if (!existsSync(skillPath)) return null;
      const meta = parseFrontmatter(readFileSync(skillPath, "utf8"));
      const cheatsheetPath = join(packDir, "cheatsheet.md");
      return {
        name: meta.name || entry.name,
        description: meta.description || `Instructions for the ${entry.name} skill.`,
        cheatsheet: existsSync(cheatsheetPath) ? readFileSync(cheatsheetPath, "utf8").trim() : null
      };
    })
    .filter((pack): pack is SkillPack => pack !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readInstructions(name: AgentName): string {
  const raw = readFileSync(join(AGENTS_DIR, name, "instructions.md"), "utf8").trim();
  if (!raw.includes(SCHEMA_SLOT)) {
    throw new Error(`Agent ${name} instructions are missing the ${SCHEMA_SLOT} slot.`);
  }
  return raw;
}

function renderSkills(name: AgentName): string {
  const packs = listAgentSkills(name);
  if (!packs.length) return "";
  const catalog = packs.map((pack) => `- ${pack.name}: ${pack.description}`).join("\n");
  const loaded = packs
    .filter((pack) => pack.cheatsheet)
    .map((pack) => `### ${pack.name}\n${pack.cheatsheet}`)
    .join("\n\n");
  return `\n\nAvailable skills (loaded procedures below; never invent from unlisted books):\n${catalog}\n\nLoaded procedures:\n${loaded}`;
}

export function renderAgentSystem(name: AgentName, schemaLine: string): string {
  return `${readInstructions(name).replaceAll(SCHEMA_SLOT, schemaLine)}${renderSkills(name)}`;
}
