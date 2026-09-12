import { useMemo, useState } from "react";
import { Alert, Button, Card } from "@heroui/react";
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
    <section className="mt-6 space-y-4 pb-28" aria-label="Call review">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Review CRM update</h2>
        <p className="text-sm text-slate-600">
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
        <ul className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" aria-label="Warnings">
          {proposal.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
          {proposal.kind === "connected" ? (
            <li>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={pending}
                  onPress={onRetryProcessing}
                >
                  Retry processing
                </Button>
            </li>
          ) : null}
        </ul>
      ) : proposal.kind === "connected" ? (
        <p>
          <Button variant="ghost" size="sm" isDisabled={pending} onPress={onRetryProcessing}>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <p className="text-muted text-sm font-medium uppercase tracking-wide">Outcomes</p>
          </Card.Header>
          <Card.Content className="text-sm">
            <p>Transport: <span className="font-medium">{proposal.transportOutcome ?? "unknown"}</span></p>
            <p className="mt-1">Semantic: <span className="font-medium">{outcomeLabel(proposal.semanticOutcome)}</span></p>
            <p className="mt-1">Qualification: <span className="font-medium">{qualificationLabel(proposal.qualification)}</span></p>
            <p className="mt-2 text-muted">{proposal.qualificationReason}</p>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <p className="text-muted text-sm font-medium uppercase tracking-wide">Next step</p>
          </Card.Header>
          <Card.Content className="text-sm">
            <p>{proposal.nextStep || "None proposed"}</p>
            <p className="text-muted mt-2">Follow-up: {formatDisplayDate(proposal.followUpAt)}</p>
            <p className="mt-2">{proposal.summary}</p>
          </Card.Content>
        </Card>
      </div>

      {proposal.criteria.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">Qualification evidence</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {proposal.criteria.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.prompt || item.id.replaceAll("_", " ")}</span>: {item.state}
                {item.evidence ? <span className="text-slate-600"> — {item.evidence}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(proposal.objections.length > 0 || proposal.painOrResearchFindings.length > 0) && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          {proposal.objections.length > 0 ? (
            <p>
              <span className="font-medium">Objections:</span> {proposal.objections.join("; ")}
            </p>
          ) : null}
          {proposal.painOrResearchFindings.length > 0 ? (
            <p className="mt-2">
              <span className="font-medium">Findings:</span> {proposal.painOrResearchFindings.join("; ")}
            </p>
          ) : null}
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">Sheet diff</h3>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-1 pr-2 font-medium">Field</th>
              <th className="py-1 pr-2 font-medium">Current</th>
              <th className="py-1 font-medium">Proposed</th>
            </tr>
          </thead>
          <tbody>
            {visibleDiff.map((row) => (
              <tr key={row.key} className={row.changed ? "bg-amber-50" : undefined}>
                <td className="py-1 pr-2 align-top">{fieldLabel(row.key, row.header)}</td>
                <td className="py-1 pr-2 align-top text-slate-600">{displayValue(row.key, row.current)}</td>
                <td className="py-1 align-top">{displayValue(row.key, row.proposed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {technicalDiff.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-600">Technical details</summary>
            <table className="mt-2 w-full text-left text-sm">
              <tbody>
                {technicalDiff.map((row) => (
                  <tr key={row.key}>
                    <td className="py-1 pr-2 align-top">{FIELD_LABELS[row.key]}</td>
                    <td className="py-1 pr-2 align-top text-slate-600">{row.current || "—"}</td>
                    <td className="py-1 align-top font-mono text-xs">{row.proposed || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}
      </section>

      {editing ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">Edit proposed values</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {EDITABLE.map((key) => (
              <label key={key} className="text-sm">
                <span className="block text-slate-600">{FIELD_LABELS[key]}</span>
                {key === "call_outcome" ? (
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    {Object.entries(SEMANTIC_OUTCOME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                ) : key === "qualification" ? (
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    {Object.entries(QUALIFICATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                ) : key === "call_status" ? (
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    {CALL_STATUS_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
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
        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Transcript</summary>
          <ol className="mt-3 space-y-2 text-sm">
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
        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Coaching replay</summary>
          <ol className="mt-3 space-y-2 text-sm">
            {proposal.coachingReplay.map((event, index) => (
              <li key={`${event.stage}-${index}`}>
                {event.stage}: {event.cue ?? "(hidden)"} {event.reason ? `— ${event.reason}` : ""}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="border-separator bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-3">
          {failedWrite ? (
            <Button isDisabled={pending} onPress={onRetryWrite}>
              Retry write
            </Button>
          ) : (
            <Button isDisabled={pending} onPress={() => onApprove(editing ? draft : undefined)}>
              Approve & next
            </Button>
          )}
          {proposal.kind === "non_connect" && !failedWrite ? (
            <>
              <Button variant="outline" isDisabled={pending} onPress={() => onApprove({ ...proposal.proposedFields, call_status: "Retry" })}>
                Retry
              </Button>
              <Button variant="outline" isDisabled={pending} onPress={onSkip}>
                Skip
              </Button>
            </>
          ) : null}
          <Button variant="outline" isDisabled={pending} onPress={() => setEditing((value) => !value)}>
            {editing ? "Hide edit" : "Edit"}
          </Button>
          <Button
            variant="danger"
            isDisabled={pending}
            onPress={() => {
              if (window.confirm("Discard this proposal without writing to the Sheet?")) {
                onDiscard();
              }
            }}
          >
            Discard proposal
          </Button>
        </div>
      </div>
    </section>
  );
}
