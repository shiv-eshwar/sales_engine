import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { bootSkeleton } from "../../src/client/components/LoadingSkeleton.js";

function html(pathname: string): string {
  return renderToStaticMarkup(bootSkeleton(pathname));
}

describe("route boot skeletons", () => {
  it("keeps Home copy as a queue list without the next-up card split", () => {
    const markup = html("/leads");
    expect(markup).toContain("Loading leads…");
    expect(markup).not.toContain("lg:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]");
    expect(markup).not.toContain("border-t-[3px] border-t-accent bg-surface shadow-sm max-lg:pb-[5.5rem]");
    expect(markup).not.toContain("Breadcrumb");
  });

  it("locks the lead brief card to pane height while the destination loads", () => {
    const markup = html("/leads/L-100");
    expect(markup).toContain("Loading lead…");
    expect(markup).toContain("data-brief-state=\"loading\"");
    expect(markup).toContain("flex h-full min-h-0 flex-col overflow-hidden");
  });

  it("uses destination labels without breadcrumb chrome", () => {
    expect(html("/leads/L-100")).toContain("Loading lead…");
    expect(html("/leads/L-100")).toContain("brief-card-pulse");
    expect(html("/leads/L-100")).not.toContain("brief-working");
    expect(html("/analytics")).toContain("Loading analytics…");
    expect(html("/settings")).toContain("Loading settings…");
    expect(html("/notifications")).toContain("Loading notifications…");
    expect(html("/diagnostics")).toContain("Loading notifications…");
    expect(html("/calls/s1/review")).toContain("Loading review…");
    expect(html("/calls/s1/review")).toContain("max-w-5xl");
    expect(html("/login")).toContain("Loading sign in…");
    expect(html("/login")).toContain("auth-wash");
    expect(html("/login")).toContain("Switch to dark theme");
    expect(html("/signup")).toContain("Loading create account…");
    expect(html("/signup")).toContain("auth-wash");
    expect(html("/calls/s1/review")).not.toContain("Breadcrumb");
    expect(html("/analytics")).not.toContain("Breadcrumb");
  });
});
