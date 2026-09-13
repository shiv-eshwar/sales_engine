import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProspectBrief } from "../../src/client/components/ProspectBrief.js";
import { prospectBrief } from "../helpers/campaigns.js";

describe("ProspectBrief scan card", () => {
  it("leads with say / ask / push-back / leave and hides extra context", () => {
    const markup = renderToStaticMarkup(
      ProspectBrief({
        preparation: {
          id: "prep-1",
          campaignId: "c1",
          campaignVersion: 1,
          leadId: "L-1",
          inputHash: "hash",
          generatedAt: "2026-09-13T10:00:00.000Z",
          research: {
            status: "complete",
            searchedAt: "2026-09-13T10:00:00.000Z",
            sources: [{ id: "source_1", title: "Northwind QA company page", url: "https://example.com/company" }],
            warnings: []
          },
          brief: prospectBrief()
        }
      })
    );
    expect(markup).toContain("Say this");
    expect(markup).toContain("Ask this");
    expect(markup).toContain("If they push back");
    expect(markup).toContain("Leave with");
    expect(markup).toContain("Company");
    expect(markup).toContain("More context");
    expect(markup).toContain("Why it may be relevant");
    expect(markup).not.toContain(">Questions<");
    expect(markup).not.toContain("These are prompts, not a script.");

    const opening = "Alex, could I ask how Northwind QA handles invoice follow-up?";
    const mintStart = markup.indexOf("bg-accent-soft");
    const openingEnd = markup.indexOf(opening) + opening.length;
    const mintSlice = markup.slice(mintStart, openingEnd);
    expect(mintSlice).toContain(opening);
    expect(mintSlice).not.toContain("Company");
    expect(markup.indexOf("Company")).toBeGreaterThan(openingEnd);
    expect(markup.indexOf("Company")).toBeLessThan(markup.indexOf("Ask this"));
  });
});
