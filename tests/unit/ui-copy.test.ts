import { describe, expect, it } from "vitest";
import {
  diagnosticCopy,
  diagnosticHeading,
  EMPTY_COPY,
  NAV_COPY,
  PAGE_TITLES,
  formatUtteranceText,
  pageTitle,
  notificationsNavLabel,
  outcomeLabel,
  qualificationLabel
} from "../../src/client/copy.js";
import { notificationCount } from "../../src/client/notifications.js";
import type { PublicProposal } from "../../src/shared/contracts.js";

describe("caller-facing copy", () => {
  it("uses human labels for outcomes and qualification", () => {
    expect(outcomeLabel("permission_to_follow_up")).toBe("Follow-up allowed");
    expect(qualificationLabel("unknown")).toBe("Unknown");
  });

  it("turns transcript gaps into a time range", () => {
    expect(formatUtteranceText("[gap]", 12_000, 18_000)).toBe("Audio missed 00:12–00:18");
    expect(formatUtteranceText("hello", 0, 1_000)).toBe("hello");
  });

  it("humanizes sheet diagnostics", () => {
    expect(diagnosticCopy({ code: "blank_lead_id", message: "x", rowNumber: 6 })).toBe(
      "Row 6 has no Lead ID — skipped."
    );
    expect(diagnosticCopy({ code: "blank_lead_id", message: "x", rowNumber: 6, fullName: "Blank ID" })).toBe(
      "Row 6 (Blank ID) has no Lead ID — skipped."
    );
    expect(diagnosticCopy({ code: "invalid_phone", message: "x", leadId: "L-102", fullName: "Sam Patel" })).toBe(
      "Sam Patel (L-102) has a phone that cannot be dialed."
    );
    expect(diagnosticHeading({ code: "invalid_phone", message: "x", leadId: "L-102", fullName: "Sam Patel" })).toBe(
      "Sam Patel"
    );
    expect(diagnosticHeading({ code: "blank_lead_id", message: "x", rowNumber: 6 })).toBe("Row 6");
  });

  it("keeps header nav names stable for icon-only links", () => {
    expect(NAV_COPY.home).toBe("Mantis");
    expect(NAV_COPY.notifications).toBe("Notifications");
    expect(NAV_COPY.analytics).toBe("Analytics");
    expect(NAV_COPY.settings).toBe("Settings");
    expect(NAV_COPY.newCampaign).toBe("New campaign");
    expect(NAV_COPY.calendar).toBe("Calendar");
    expect(NAV_COPY.campaign).toBe("Campaign");
    expect(NAV_COPY.editOffering).toBe("Edit offering");
    expect(notificationsNavLabel(0)).toBe("Notifications");
    expect(notificationsNavLabel(3)).toBe("Notifications, 3 waiting");
  });

  it("builds distinct browser tab titles", () => {
    expect(pageTitle()).toBe("Mantis");
    expect(PAGE_TITLES.home).toBe("Ready · Mantis");
    expect(PAGE_TITLES.login).toBe("Sign in · Mantis");
    expect(PAGE_TITLES.analytics).toBe("Analytics · Mantis");
    expect(PAGE_TITLES.notifications).toBe("Notifications · Mantis");
    expect(PAGE_TITLES.settings).toBe("Settings · Mantis");
    expect(PAGE_TITLES.campaignNew).toBe("New campaign · Mantis");
    expect(PAGE_TITLES.lead("Alex Rivera")).toBe("Alex Rivera · Mantis");
    expect(PAGE_TITLES.lead("  ")).toBe("Mantis");
    expect(PAGE_TITLES.review("Alex Rivera")).toBe("Review · Alex Rivera · Mantis");
    expect(PAGE_TITLES.review()).toBe("Review · Mantis");
  });

  it("keeps empty-state copy operator-facing", () => {
    expect(EMPTY_COPY.campaign.title).toBe("Create a campaign");
    expect(EMPTY_COPY.queue.title).toBe("No one is ready to call");
    expect(EMPTY_COPY.notifications.title).toBe("Nothing waiting");
  });

  it("counts reviews and queue diagnostics together", () => {
    expect(notificationCount(null, [])).toBe(0);
    expect(
      notificationCount(null, [
        { code: "invalid_phone", message: "x" },
        { code: "blank_lead_id", message: "y" }
      ])
    ).toBe(2);
    expect(
      notificationCount({ status: "pending_review" } as PublicProposal, [
        { code: "invalid_phone", message: "x" }
      ])
    ).toBe(2);
  });
});
