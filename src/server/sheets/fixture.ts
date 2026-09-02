import type { SheetsConfig } from "../../shared/schemas.js";
import { MemorySheetStore } from "./memory.js";

export const EXAMPLE_HEADERS = [
  "Lead ID",
  "Full Name",
  "Phone",
  "Company",
  "Job Title",
  "Enrichment",
  "Campaign",
  "Status",
  "Call Status",
  "Call Attempts",
  "Last Called At",
  "Call Outcome",
  "Qualification",
  "Qualification Reason",
  "Objections",
  "Next Step",
  "Follow Up At",
  "Call Summary",
  "Twilio Call SID",
  "Recording SID"
];

function pad(cells: string[]): string[] {
  const row = [...cells];
  while (row.length < EXAMPLE_HEADERS.length) {
    row.push("");
  }
  return row;
}

export function exampleFixtureRows(): string[][] {
  return [
    pad([
      "L-100",
      "Alex Rivera",
      "+14155550100",
      "Northwind QA",
      "Head of Engineering",
      "Series B. Team of 40. Ships weekly.",
      "lamina-sales",
      "Ready"
    ]),
    pad([
      "L-101",
      "Jordan Chen",
      "415-555-0101",
      "Blue Harbor",
      "Founder",
      "Recently hired first PM.",
      "lamina-sales",
      "Retry",
      "Retry"
    ]),
    pad([
      "L-102",
      "Sam Patel",
      "not-a-phone",
      "Harbor Labs",
      "CTO",
      "Uses in-house QA only.",
      "lamina-sales",
      "Ready"
    ]),
    pad([
      "L-200",
      "Done Contact",
      "+14155550199",
      "Closed Co",
      "CEO",
      "Already called.",
      "lamina-sales",
      "Done",
      "Completed"
    ]),
    pad(["", "Blank ID", "+14155550111", "Ghost Co", "PM", "", "lamina-sales", "Ready"]),
    pad(["L-DUP", "Dup One", "+14155550112", "Dup Co", "PM", "", "lamina-sales", "Ready"]),
    pad(["L-DUP", "Dup Two", "+14155550113", "Dup Co", "PM", "", "lamina-sales", "Ready"])
  ];
}

export function createExampleMemoryStore(config?: SheetsConfig): MemorySheetStore {
  void config;
  return new MemorySheetStore(EXAMPLE_HEADERS, exampleFixtureRows());
}

export function reorderHeaders<T>(headers: T[], from: number, to: number): T[] {
  const copy = [...headers];
  const [moved] = copy.splice(from, 1);
  if (moved === undefined) {
    return copy;
  }
  copy.splice(to, 0, moved);
  return copy;
}
