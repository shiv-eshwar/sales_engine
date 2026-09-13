import type { PublicProposal } from "./contracts.js";

const FIELD_LABELS: Record<string, string> = {
  call_status: "Call Status",
  call_attempts: "Call attempts",
  last_called_at: "Last called",
  call_outcome: "Call outcome",
  qualification: "Qualification",
  qualification_reason: "Qualification reason",
  objections: "Objections",
  next_step: "Next step",
  follow_up_at: "Follow-up",
  call_summary: "Call summary",
  twilio_call_sid: "Twilio Call SID",
  recording_sid: "Recording SID"
};

const TECHNICAL = new Set(["twilio_call_sid", "recording_sid", "call_attempts", "last_called_at"]);

function labelFor(key: string, header?: string): string {
  if (header && header.trim() && header !== key) return header;
  return FIELD_LABELS[key] ?? key;
}

function display(value: string): string {
  return value.trim() ? value : "—";
}

/** Deterministic first review-agent turn from the stored proposal (no LLM). */
export function openingReviewMessage(proposal: PublicProposal): string {
  const who = proposal.contactName.trim() || proposal.leadId;
  const parts: string[] = [];

  if (proposal.semanticOutcome === "do_not_contact" || proposal.proposedFields.call_status === "Do Not Contact") {
    parts.push(`Do not contact. ${who} asked not to be called again. Confirming the write will suppress this lead from the queue.`);
  } else if (proposal.kind === "non_connect") {
    parts.push(`The call with ${who} did not connect (${proposal.transportOutcome ?? "no connect"}). I did not invent a conversation outcome.`);
  } else {
    const outcome = proposal.semanticOutcome.replaceAll("_", " ");
    parts.push(`Here's what happened on the call with ${who}: ${outcome}.`);
  }

  if (proposal.summary.trim()) {
    parts.push(proposal.summary.trim());
  }

  const quotes = proposal.criteria
    .map((item) => item.evidence?.trim())
    .filter((item): item is string => Boolean(item));
  for (const finding of proposal.painOrResearchFindings) {
    if (finding.trim()) quotes.push(finding.trim());
  }
  const utteranceQuotes = proposal.utterances
    .filter((item) => item.speaker === "contact" && item.text.trim() && item.text !== "[gap]")
    .slice(0, 3)
    .map((item) => item.text.trim());
  const evidence = [...new Set([...quotes, ...utteranceQuotes])].slice(0, 4);
  if (evidence.length > 0) {
    parts.push(`Evidence:\n${evidence.map((line) => `“${line}”`).join("\n")}`);
  }

  const visible = proposal.diff.filter((row) => row.changed && !TECHNICAL.has(row.key));
  if (visible.length > 0) {
    const rows = visible.map((row) => {
      const name = labelFor(row.key, row.header);
      return `${name}: ${display(row.current)} → Proposed ${display(row.proposed)}`;
    });
    parts.push(`Proposed CRM update:\n${rows.join("\n")}`);
  } else {
    parts.push("No Sheet fields change.");
  }

  if (proposal.warnings.length > 0) {
    parts.push(proposal.warnings.join(" "));
  }
  if (proposal.status === "pending_retry" && proposal.lastError) {
    parts.push(`The last Sheet write failed: ${proposal.lastError}. I can retry the same proposal.`);
  }

  parts.push("Nothing is written until you confirm. Ask me to change a field, or tell me to write this update.");
  return parts.join("\n\n");
}
