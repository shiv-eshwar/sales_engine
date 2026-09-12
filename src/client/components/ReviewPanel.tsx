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
  outcomeLabel,
  qualificationLabel
} from "../copy";

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

  const changedDiff = useMemo(() => proposal.diff.filter((row) => row.changed), [proposal.diff]);
  const visibleDiff = (changedDiff.length > 0 ? changedDiff : proposal.diff).filter(
    (row) => !TECHNICAL_FIELD_KEYS.has(row.key)
  );
  const technicalDiff = proposal.diff.filter((row) => TECHNICAL_FIELD_KEYS.has(row.key));

  function displayValue(key: WriteFieldKey, value: string): string {
    if (!value) return "—";
    if (key === "call_outcome") return outcomeLabel(value);
    if (key === "qualification") return qualificationLabel(value);
    if (DATETIME_FIELD_KEYS.has(key)) return formatDisplayDate(value);
    return value;
  }

  return (
    <section className="space-y-8 pb-28" aria-label="Call review">
      <header className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Review</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Review CRM update</h2>
        <p className="mt-2 text-sm text-muted">
          {proposal.contactName}. Nothing is written until you approve.
        </p>
      </header>

      {dnc ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Do not contact. Approving this proposal writes a suppression status so this lead will not return to the eligible queue.</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <ul className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground" aria-label="Warnings">
          {proposal.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
          {proposal.kind === "connected" ? (
            <li className="mt-2">
              <Button variant="ghost" size="sm" className="rounded-lg!" isDisabled={pending} onPress={onRetryProcessing}>
                Retry processing
              </Button>
            </li>
          ) : null}
        </ul>
      ) : proposal.kind === "connected" ? (
        <p>
          <Button variant="ghost" size="sm" className="rounded-lg!" isDisabled={pending} onPress={onRetryProcessing}>
            Retry processing
          </Button>
        </p>
      ) : null}

      {failedWrite ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Sheet write failed and is waiting for retry. {proposal.lastError}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {error ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Outcomes</p>
          <p className="mt-2 text-xl font-semibold tracking-tight">
            {outcomeLabel(proposal.semanticOutcome)}
          </p>
          <p className="mt-2 text-sm text-muted">
            {qualificationLabel(proposal.qualification)}
            {proposal.transportOutcome ? ` · ${proposal.transportOutcome.replaceAll("_", " ")}` : ""}
          </p>
          {proposal.qualificationReason ? (
            <p className="mt-3 max-w-[32em] text-sm leading-relaxed text-muted">{proposal.qualificationReason}</p>
          ) : null}
        </section>
        <section className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Next step</p>
          <p className="mt-2 text-lg font-semibold leading-snug">
            {proposal.nextStep || "None proposed"}
          </p>
          <p className="mt-2 text-sm text-muted">Follow-up {formatDisplayDate(proposal.followUpAt)}</p>
          {proposal.summary ? <p className="mt-3 max-w-[32em] text-sm leading-relaxed text-muted">{proposal.summary}</p> : null}
        </section>
      </div>

      {proposal.criteria.length > 0 ? (
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Qualification evidence</p>
          <ul className="mt-3 max-w-2xl space-y-3 text-sm">
            {proposal.criteria.map((item) => (
              <li key={item.id}>
                <span className="font-semibold">{item.prompt || item.id.replaceAll("_", " ")}</span>
                <span className="text-sm text-muted"> · {item.state}</span>
                {item.evidence ? <p className="mt-1 text-sm text-muted">{item.evidence}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(proposal.objections.length > 0 || proposal.painOrResearchFindings.length > 0) && (
        <section className="max-w-2xl text-sm">
          {proposal.objections.length > 0 ? (
            <p>
              <span className="font-semibold">Objections. </span>
              {proposal.objections.join("; ")}
            </p>
          ) : null}
          {proposal.painOrResearchFindings.length > 0 ? (
            <p className={proposal.objections.length > 0 ? "mt-3" : undefined}>
              <span className="font-semibold">Findings. </span>
              {proposal.painOrResearchFindings.join("; ")}
            </p>
          ) : null}
        </section>
      )}

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Sheet diff</p>
        <div className="mt-3 overflow-hidden rounded-lg bg-surface shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-separator">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Field</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Current</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Proposed</th>
              </tr>
            </thead>
            <tbody>
              {visibleDiff.map((row) => (
                <tr key={row.key} className={`border-b border-separator last:border-0 ${row.changed ? "bg-accent-soft" : ""}`}>
                  <td className="px-4 py-3">{fieldLabel(row.key, row.header)}</td>
                  <td className="px-4 py-3 text-muted">{displayValue(row.key, row.current)}</td>
                  <td className="px-4 py-3 font-medium">{displayValue(row.key, row.proposed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {technicalDiff.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4">Technical details</summary>
            <table className="mt-2 w-full text-left text-sm">
              <tbody>
                {technicalDiff.map((row) => (
                  <tr key={row.key} className="border-b border-separator last:border-0">
                    <td className="px-4 py-3">{FIELD_LABELS[row.key]}</td>
                    <td className="px-4 py-3 text-muted">{row.current || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.proposed || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}
      </section>

      {editing ? (
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Edit proposed values</p>
          <div className="mt-4 flex max-w-2xl flex-col gap-6 sm:grid sm:grid-cols-2 sm:gap-5">
            {EDITABLE.map((key) => (
              <label key={key} className="flex flex-col gap-2 text-sm">
                <span className="text-sm text-muted">{FIELD_LABELS[key]}</span>
                {key === "call_outcome" ? (
                  <select
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    {Object.entries(SEMANTIC_OUTCOME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                ) : key === "qualification" ? (
                  <select
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                    value={draft[key] ?? ""}
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
        </section>
      ) : null}

      {proposal.utterances.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Transcript</summary>
          <ol className="mt-3 max-w-2xl space-y-2 text-sm">
            {proposal.utterances.map((utterance) => (
              <li key={utterance.id}>
                <span className="font-semibold">{utterance.speaker === "contact" ? "Contact" : "Caller"}: </span>
                {formatUtteranceText(utterance.text, utterance.startedAtMs, utterance.endedAtMs)}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {proposal.coachingReplay.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Coaching replay</summary>
          <ol className="mt-3 max-w-2xl space-y-2 text-sm">
            {proposal.coachingReplay.map((event, index) => (
              <li key={`${event.stage}-${index}`}>
                {event.stage}: {event.cue ?? "(hidden)"} {event.reason ? `— ${event.reason}` : ""}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 bg-background px-6 py-3 shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          {failedWrite ? (
            <Button className="rounded-lg!" isDisabled={pending} onPress={onRetryWrite}>
              Retry write
            </Button>
          ) : (
            <Button className="rounded-lg!" isDisabled={pending} onPress={() => onApprove(editing ? draft : undefined)}>
              Approve & next
            </Button>
          )}
          {proposal.kind === "non_connect" && !failedWrite ? (
            <>
              <Button variant="outline" className="rounded-lg!" isDisabled={pending} onPress={() => onApprove({ ...proposal.proposedFields, call_status: "Retry" })}>
                Retry
              </Button>
              <Button variant="outline" className="rounded-lg!" isDisabled={pending} onPress={onSkip}>
                Skip
              </Button>
            </>
          ) : null}
          <Button variant="ghost" className="rounded-lg!" isDisabled={pending} onPress={() => setEditing((value) => !value)}>
            {editing ? "Hide edit" : "Edit"}
          </Button>
          <button
            type="button"
            className="ml-auto text-sm font-semibold text-danger hover:underline hover:underline-offset-4"
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
