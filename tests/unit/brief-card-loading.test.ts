import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BriefCardSkeleton, BriefLoading, bootSkeleton } from "../../src/client/components/LoadingSkeleton.js";

describe("brief card loading geometry", () => {
  it("fills the pane and locks overflow while researching", () => {
    const markup = renderToStaticMarkup(
      BriefLoading({
        title: "Researching Acme…",
        detail: "Preparing questions for Ada."
      })
    );
    expect(markup).toContain("AI prospect brief");
    expect(markup).toContain("data-brief-state=\"loading\"");
    expect(markup).toContain("flex h-full min-h-0 flex-col overflow-hidden");
    expect(markup).toContain("Researching Acme…");
  });

  it("keeps the lead boot brief on the same locked card", () => {
    const boot = renderToStaticMarkup(bootSkeleton("/leads/L-1"));
    const skeleton = renderToStaticMarkup(BriefCardSkeleton());
    expect(boot).toContain("data-brief-state=\"loading\"");
    expect(skeleton).toContain("flex h-full min-h-0 flex-col overflow-hidden");
    expect(skeleton).toContain("flex-1 flex-col overflow-hidden");
  });
});
