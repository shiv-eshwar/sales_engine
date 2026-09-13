import { useMemo, useState } from "react";
import { Alert, Button } from "@heroui/react";
import type { PublicProposal, PublicWriteFields, WriteFieldKey } from "../../shared/contracts";
import {
  CALL_STATUS_OPTIONS,
  DATETIME_FIELD_KEYS,
  FIELD_LABELS,
  QUALIFICATION_LABELS,
  SEMANTIC_OUTCOME_LABELS,
  TECHNICAL_FIELD_KEYS,
  fieldLabel,
  formatDisplayDate,
  formatUtteranceText,
  humanizeId,
  outcomeLabel,
  qualificationLabel
} from "../copy";
import { SCROLL_X, SHELL } from "../layout/shell";

type ReviewPanelProps = {
  proposal: PublicProposal;
  pending: boolean;
  error: string | null;
  onApprove: (fields?: PublicWriteFields) => void;
  onRetryWrite: () => void;
  onRetryProcessing: () => void;
  onSkip: () => void;
  onDiscard: () => void;
};

const EDITABLE: WriteFieldKey[] = [
  "call_status",
  "call_outcome",
  "qualification",
  "qualification_reason",
  "objections",
  "next_step",
  "follow_up_at",
  "call_summary"
];

const NON_CONNECT_EDITABLE: WriteFieldKey[] = ["call_status", "call_outcome"];

const TRANSPORT_OUTCOME_LABELS: Record<string, string> = {
  canceled: "Canceled",
  "no-answer": "No answer",
  busy: "Busy",
  failed: "Failed",
  completed: "Completed"
};

function reviewHeadline(proposal: PublicProposal): string {
  if (proposal.kind === "non_connect") {
    return humanizeId(proposal.transportOutcome || proposal.semanticOutcome);
  }
  const semantic = outcomeLabel(proposal.semanticOutcome);
  if (semantic !== "Unknown") return semantic;
  return humanizeId(proposal.transportOutcome || proposal.semanticOutcome);
}

export function ReviewPanel({
  proposal,
  pending,
  error,
  onApprove,
  onRetryWrite,
  onRetryProcessing,
  onSkip,
  onDiscard
}: ReviewPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PublicWriteFields>(proposal.proposedFields);
  const dnc = proposal.semanticOutcome === "do_not_contact" || proposal.proposedFields.call_status === "Do Not Contact";
  const failedWrite = proposal.status === "pending_retry";
  const shownCriteria = proposal.criteria.filter(
    (item) => item.state !== "unknown" || Boolean(item.evidence)
  );
  const findings = proposal.painOrResearchFindings.filter(Boolean);

  const visibleDiff = useMemo(
    () => proposal.diff.filter((row) => row.changed && !TECHNICAL_FIELD_KEYS.has(row.key)),
    [proposal.diff]
  );
  const technicalDiff = proposal.diff.filter((row) => row.changed && TECHNICAL_FIELD_KEYS.has(row.key));
  const showCurrent = visibleDiff.some((row) => Boolean(row.current));
  const showStory = shownCriteria.length > 0 || findings.length > 0;
  const editKeys = proposal.kind === "non_connect" ? NON_CONNECT_EDITABLE : EDITABLE;
  const outcomeOptions = useMemo(() => {
    const base = proposal.kind === "non_connect" ? TRANSPORT_OUTCOME_LABELS : SEMANTIC_OUTCOME_LABELS;
    const current = draft.call_outcome ?? "";
    if (current && !(current in base)) {
      return { [current]: humanizeId(current), ...base };
    }
    return base;
  }, [draft.call_outcome, proposal.kind]);

  function displayValue(key: WriteFieldKey, value: string): string {
    if (!value) return "—";
    if (key === "call_outcome") return TRANSPORT_OUTCOME_LABELS[value] ?? outcomeLabel(value);
    if (key === "qualification") return qualificationLabel(value);
    if (DATETIME_FIELD_KEYS.has(key)) return formatDisplayDate(value);
    return value;
  }

  return (
    <section className="pb-28" aria-label="Call review">
      <header className="max-w-[36em]">
        <h2 className="text-2xl font-semibold tracking-tight">Review CRM update</h2>
        <p className="mt-2 text-sm text-muted">Nothing is written until you approve.</p>
      </header>

      {dnc ? (
        <Alert status="danger" className="mt-6" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Do not contact. Approving this writes a suppression status so this lead will not return to the queue.</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <div className="mt-6 rounded-lg bg-warning-soft px-5 py-4 text-sm text-warning-soft-foreground" aria-label="Warnings">
          <ul className="space-y-2">
            {proposal.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          {proposal.kind === "connected" ? (
            <button
              type="button"
              className="mt-3 text-sm font-semibold hover:underline hover:underline-offset-4 disabled:opacity-50"
              disabled={pending}
              onClick={onRetryProcessing}
            >
              Retry processing
            </button>
          ) : null}
        </div>
      ) : null}

      {failedWrite ? (
        <Alert status="danger" className="mt-6" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Sheet write failed and is waiting for retry. {proposal.lastError}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {error ? (
        <Alert status="danger" className="mt-6" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      <div className="mt-10 max-w-4xl">
        {showStory ? (
          <div>
            <p className="text-xl font-semibold tracking-tight">{reviewHeadline(proposal)}</p>
            {shownCriteria.length > 0 ? (
              <ul className="mt-8 max-w-[36em] space-y-4 text-sm">
                {shownCriteria.map((item) => (
                  <li key={item.id}>
                    <p>
                      <span className="font-medium">{item.prompt || humanizeId(item.id)}</span>
                      <span className="text-muted"> · {item.state}</span>
                    </p>
                    {item.evidence ? <p className="mt-1 leading-relaxed text-muted">{item.evidence}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {findings.length > 0 ? (
              <p className="mt-8 max-w-[36em] text-sm leading-relaxed text-muted">{findings.join("; ")}</p>
            ) : null}
          </div>
        ) : null}

        {visibleDiff.length > 0 ? (
          <div className={`${showStory ? "mt-8" : ""} w-max max-w-full ${SCROLL_X} rounded-lg bg-surface shadow-sm`}>
            <table className="w-max max-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-separator">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Field</th>
                  {showCurrent ? (
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Current</th>
                  ) : null}
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Proposed</th>
                </tr>
              </thead>
              <tbody>
                {visibleDiff.map((row) => (
                  <tr key={row.key} className="border-b border-separator bg-accent-soft last:border-0">
                    <td className="whitespace-nowrap px-5 py-3.5 pr-16">{fieldLabel(row.key, row.header)}</td>
                    {showCurrent ? (
                      <td className="px-5 py-3.5 pr-16 text-muted">{displayValue(row.key, row.current)}</td>
                    ) : null}
                    <td className="px-5 py-3.5 font-medium">{displayValue(row.key, row.proposed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={`${showStory ? "mt-8" : ""} text-sm text-muted`}>No Sheet fields change.</p>
        )}

        {technicalDiff.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4">Technical details</summary>
            <table className="mt-3 w-full text-left text-sm">
              <tbody>
                {technicalDiff.map((row) => (
                  <tr key={row.key} className="border-b border-separator last:border-0">
                    <td className="py-2.5 pr-4">{FIELD_LABELS[row.key]}</td>
                    <td className="py-2.5 pr-4 text-muted">{row.current || "—"}</td>
                    <td className="py-2.5 font-mono text-xs">{row.proposed || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}

        {editing ? (
          <div className={`mt-8 flex flex-col gap-6 ${editKeys.length > 2 ? "sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5" : "max-w-md"}`}>
            {editKeys.map((key) => (
              <label key={key} className="flex flex-col gap-2 text-sm">
                <span className="text-sm text-muted">{FIELD_LABELS[key]}</span>
                {key === "call_outcome" ? (
                  <select
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    {Object.entries(outcomeOptions).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                ) : key === "qualification" ? (
                  <select
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                    value={draft[key] || "unknown"}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    {Object.entries(QUALIFICATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                ) : key === "call_status" ? (
                  <select
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    {CALL_STATUS_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                    value={draft[key] ?? ""}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, [key]: event.target.value }));
                    }}
                  />
                )}
              </label>
            ))}
          </div>
        ) : null}

        {proposal.utterances.length > 0 ? (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground">Transcript</summary>
            <ol className="mt-4 max-w-[36em] space-y-2.5 text-sm">
              {proposal.utterances.map((utterance) => (
                <li key={utterance.id}>
                  <span className="font-medium">{utterance.speaker === "contact" ? "Contact" : "Caller"}: </span>
                  {formatUtteranceText(utterance.text, utterance.startedAtMs, utterance.endedAtMs)}
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        {proposal.coachingReplay.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground">Coaching replay</summary>
            <ol className="mt-4 max-w-[36em] space-y-2.5 text-sm text-muted">
              {proposal.coachingReplay.map((event, index) => (
                <li key={`${event.stage}-${index}`}>
                  {humanizeId(event.stage)}
                  {event.cue ? `: ${event.cue}` : " (hidden)"}
                  {event.reason ? ` — ${event.reason}` : ""}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 bg-background py-3 shadow-[0_-8px_24px_-12px_hsl(220_20%_12%/0.18)]"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className={`${SHELL} flex flex-wrap items-center gap-3`}>
          {failedWrite ? (
            <Button className="min-h-11 rounded-lg!" isDisabled={pending} onPress={onRetryWrite}>
              Retry write
            </Button>
          ) : (
            <Button className="min-h-11 rounded-lg!" isDisabled={pending} onPress={() => onApprove(editing ? draft : undefined)}>
              Approve & next
            </Button>
          )}
          {proposal.kind === "non_connect" && !failedWrite ? (
            <>
              <Button variant="outline" className="min-h-11 rounded-lg!" isDisabled={pending} onPress={() => onApprove({ ...proposal.proposedFields, call_status: "Retry" })}>
                Retry
              </Button>
              <Button variant="outline" className="min-h-11 rounded-lg!" isDisabled={pending} onPress={onSkip}>
                Skip
              </Button>
            </>
          ) : null}
          <Button variant="ghost" className="min-h-11 rounded-lg!" isDisabled={pending} onPress={() => setEditing((value) => !value)}>
            {editing ? "Hide edit" : "Edit"}
          </Button>
          <button
            type="button"
            className="ml-auto min-h-11 text-sm font-semibold text-danger hover:underline hover:underline-offset-4"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Discard this proposal without writing to the Sheet?")) {
                onDiscard();
              }
            }}
          >
            Discard proposal
          </button>
        </div>
      </div>
    </section>
  );
}
