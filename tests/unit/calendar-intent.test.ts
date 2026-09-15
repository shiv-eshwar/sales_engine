import { describe, expect, it } from "vitest";
import { draftFromUnknown } from "../../src/server/calendar/draft.js";
import { sanitizeCalendarDraft, toCalendarInsertInput } from "../../src/server/calendar/insert.js";

const START = "2026-09-17T18:00:00.000Z";
const END = "2026-09-17T18:30:00.000Z";

describe("calendar intents", () => {
  it("sends meeting invites to attendees", () => {
    const input = toCalendarInsertInput({
      intent: "meeting",
      title: "Ada / Example",
      start: START,
      end: END,
      timezone: "UTC",
      attendees: ["ada@example.com"],
      meet: true,
      notes: "Intro"
    });
    expect(input.sendUpdates).toBe("all");
    expect(input.attendees).toEqual(["ada@example.com"]);
    expect(input.meet).toBe(true);
    expect(input.popupMinutes).toBeNull();
  });

  it("keeps callbacks and reminders on the operator calendar", () => {
    const callback = toCalendarInsertInput(
      sanitizeCalendarDraft({
        intent: "callback",
        title: "Call Ada",
        start: START,
        end: END,
        timezone: "UTC",
        attendees: ["ada@example.com"],
        meet: true,
        notes: "They asked for Wednesday"
      })
    );
    expect(callback.sendUpdates).toBe("none");
    expect(callback.attendees).toEqual([]);
    expect(callback.meet).toBe(false);
    expect(callback.popupMinutes).toBe(15);

    const reminder = toCalendarInsertInput({
      intent: "reminder",
      title: "Prep call",
      start: START,
      end: END,
      timezone: "UTC",
      attendees: ["ada@example.com"],
      meet: false,
      notes: ""
    });
    expect(reminder.sendUpdates).toBe("none");
    expect(reminder.attendees).toEqual([]);
  });

  it("defaults callback duration when the model omits end", () => {
    const draft = draftFromUnknown(
      { intent: "callback", start: START, title: "Call Ada" },
      "Call Ada"
    );
    expect(draft).not.toBeNull();
    expect(draft!.end).toBe("2026-09-17T18:15:00.000Z");
    expect(draft!.attendees).toEqual([]);
  });
});
