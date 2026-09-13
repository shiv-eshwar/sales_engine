import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { SettingsView } from "../../src/client/pages/SettingsPage.js";
import { SETTINGS_COPY } from "../../src/client/copy.js";
import { isWorkspacePath } from "../../src/client/layout/shell.js";
import type { SheetInfo } from "../../src/shared/contracts.js";

const sheetOk: SheetInfo = {
  status: "ok",
  message: "Sheet schema valid (memory)",
  diagnostics: [],
  backend: "memory",
  spreadsheetId: "mem-1",
  sheetName: "Sheet1",
  url: null,
  manageable: false
};

const sheetEmpty: SheetInfo = {
  status: "unconfigured",
  message: "Sheet is not configured",
  diagnostics: [],
  backend: "none",
  spreadsheetId: null,
  sheetName: null,
  url: null,
  manageable: false
};

const providerOk = { status: "ok" as const, message: "Ready", callerId: "+15555550100" };
const providerOff = { status: "not_configured" as const, message: "Not configured" };

function markup(view: Parameters<typeof SettingsView>[0]) {
  return renderToStaticMarkup(
    MemoryRouter({ children: SettingsView(view) })
  );
}

describe("Settings page", () => {
  it("treats /settings as a workspace path", () => {
    expect(isWorkspacePath("/settings")).toBe(true);
    expect(isWorkspacePath("/analytics")).toBe(false);
  });

  it("shows Calendar empty state with Connect when OAuth is configured", () => {
    const html = markup({
      calendar: { configured: true, connected: false, email: null },
      sheet: sheetEmpty,
      campaignName: null,
      hasCampaigns: false,
      canEditOffering: false,
      twilio: providerOff,
      deviceStatus: "offline",
      deviceDetail: "offline",
      ai: providerOff,
      research: providerOff,
      deepgram: "Deepgram not configured; transcription will be interrupted",
      flash: null
    });
    expect(html).toContain(SETTINGS_COPY.calendar.disconnectedTitle);
    expect(html).toContain(SETTINGS_COPY.calendar.connect);
    expect(html).not.toContain(SETTINGS_COPY.calendar.disconnect);
    expect(html).toContain(SETTINGS_COPY.twilio.emptyTitle);
    expect(html).not.toContain("keypad");
  });

  it("shows connected Calendar email and Disconnect", () => {
    const html = markup({
      calendar: { configured: true, connected: true, email: "op@example.com" },
      sheet: sheetOk,
      campaignName: "Lamina founder sales",
      hasCampaigns: true,
      canEditOffering: true,
      twilio: providerOk,
      deviceStatus: "registered",
      deviceDetail: "registered",
      ai: { status: "ok", message: "AI generation configured" },
      research: providerOff,
      deepgram: "Deepgram API key is set",
      flash: null
    });
    expect(html).toContain("op@example.com");
    expect(html).toContain(SETTINGS_COPY.calendar.disconnect);
    expect(html).not.toContain(SETTINGS_COPY.calendar.connect);
    expect(html).toContain(SETTINGS_COPY.sheet.sample);
    expect(html).toContain(SETTINGS_COPY.twilio.registered);
    expect(html).toContain(SETTINGS_COPY.providers.ai);
  });
});
