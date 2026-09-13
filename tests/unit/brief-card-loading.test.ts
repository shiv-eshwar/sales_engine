import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BriefCardSkeleton, BriefLoading, bootSkeleton } from "../../src/client/components/LoadingSkeleton.js";

describe("brief card loading geometry", () => {
  it("fills the pane with a pulsing white card while researching", () => {
    const markup = renderToStaticMarkup(BriefLoading({}));
    expect(markup).toContain("AI prospect brief");
    expect(markup).toContain("data-brief-state=\"loading\"");
    expect(markup).toContain("brief-card-pulse");
    expect(markup).toContain("flex h-full min-h-0 flex-col overflow-hidden");
    expect(markup).toContain("bg-surface");
    expect(markup).not.toContain("Researching");
    expect(markup).not.toContain("Say this");
    expect(markup).not.toContain("accent-soft");
    expect(markup).not.toContain("animate-spin");
    expect(markup).not.toContain("brief-working");
  });

  it("keeps the lead boot brief on the same locked card", () => {
    const boot = renderToStaticMarkup(bootSkeleton("/leads/L-1"));
    const skeleton = renderToStaticMarkup(BriefCardSkeleton());
    expect(boot).toContain("data-brief-state=\"loading\"");
    expect(boot).toContain("brief-card-pulse");
    expect(skeleton).toContain("flex h-full min-h-0 flex-col overflow-hidden");
    expect(skeleton).not.toContain("accent-soft");
    expect(skeleton).not.toContain("brief-working");
  });
});
