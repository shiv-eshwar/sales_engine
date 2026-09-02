import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCampaigns } from "../../src/server/config/campaigns.js";
import { loadPlaybook } from "../../src/server/config/playbook.js";
import { campaignConfigSchema } from "../../src/shared/schemas.js";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

describe("Campaign and playbook YAML", () => {
  it("loads sales, research, and networking campaigns", () => {
    const campaigns = loadCampaigns("./config/campaigns");
    expect(campaigns.map((item) => item.type).sort()).toEqual(["networking", "research", "sales"]);
  });

  it("loads the cold-calling playbook including confidence and objection guides", () => {
    const playbook = loadPlaybook("./config/playbooks/cold-calling.yaml");
    expect(playbook.cue_min_confidence).toBe(0.5);
    expect(playbook.objection_guides?.existing_solution?.first_cue).toBe("clarify");
  });

  it("rejects unknown campaign types", () => {
    const raw = parse(readFileSync("./config/campaigns/sales.example.yaml", "utf8")) as Record<string, unknown>;
    raw.type = "upsell";
    expect(() => campaignConfigSchema.parse(raw)).toThrow();
  });

  it("rejects sales-close outcomes on research and networking campaigns", () => {
    const dir = join(tmpdir(), `campaigns-${Date.now()}`);
    mkdirSync(dir);
    writeFileSync(
      join(dir, "bad.yaml"),
      `id: bad-research
name: Bad
type: research
version: 1
objective: Capture evidence
opening_context: x
approved_claims:
  - id: c1
    text: We gather evidence.
    evidence: brief
required_questions:
  - id: q1
    prompt: Example?
    required: true
forbidden_behaviors:
  - pitch_unless_asked
success_outcomes:
  - meeting_booked
terminal_outcomes:
  - not_interested
qualification:
  criteria:
    relevant_problem:
      prompt: Relevant?
      required_for_qualified: true
  disqualifiers:
    - explicit_do_not_contact
`
    );
    expect(() => loadCampaigns(dir)).toThrow(/sales-close outcome/);
    rmSync(dir, { recursive: true, force: true });
  });
});
