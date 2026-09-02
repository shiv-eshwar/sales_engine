import { useMemo, useState } from "react";
import type { PublicProposal, PublicWriteFields, WriteFieldKey } from "../../shared/contracts";

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

  return (
    <section className="mt-6 space-y-4" aria-label="Call review">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Review CRM update</h2>
        <p className="text-sm text-slate-600">
          {proposal.contactName} · {proposal.leadId}. Nothing is written until you approve.
        </p>
      </header>

      {dnc ? (
        <p
          role="alert"
          className="rounded-md border-2 border-red-700 bg-red-50 p-4 text-sm font-semibold text-red-950"
        >
          Do not contact. Approving this proposal writes a suppression status so this lead will not
          return to the eligible queue.
        </p>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <ul className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" aria-label="Warnings">
          {proposal.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {failedWrite ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Sheet write failed and is waiting for retry. {proposal.lastError}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">Outcomes</h3>
          <p className="mt-2 text-sm">
            Transport: <span className="font-medium">{proposal.transportOutcome ?? "unknown"}</span>
          </p>
          <p className="mt-1 text-sm">
            Semantic: <span className="font-medium">{proposal.semanticOutcome.replaceAll("_", " ")}</span>
          </p>
          <p className="mt-1 text-sm">
            Qualification: <span className="font-medium">{proposal.qualification}</span>
          </p>
          <p className="mt-2 text-sm text-slate-700">{proposal.qualificationReason}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">Next step</h3>
          <p className="mt-2 text-sm text-slate-800">{proposal.nextStep || "None proposed"}</p>
          <p className="mt-2 text-sm text-slate-600">Follow-up: {proposal.followUpAt || "none"}</p>
          <p className="mt-2 text-sm text-slate-800">{proposal.summary}</p>
        </article>
      </div>

      {proposal.criteria.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">Qualification evidence</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {proposal.criteria.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.id.replaceAll("_", " ")}</span>: {item.state}
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
            {(changedDiff.length > 0 ? changedDiff : proposal.diff).map((row) => (
              <tr key={row.key} className={row.changed ? "bg-amber-50" : undefined}>
                <td className="py-1 pr-2 align-top">{row.header}</td>
                <td className="py-1 pr-2 align-top text-slate-600">{row.current || "—"}</td>
                <td className="py-1 align-top">{row.proposed || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editing ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">Edit proposed values</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {EDITABLE.map((key) => (
              <label key={key} className="text-sm">
                <span className="block text-slate-600">{key.replaceAll("_", " ")}</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                  value={draft[key] ?? ""}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, [key]: event.target.value }));
                  }}
                />
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
                {utterance.text}
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

      <div className="flex flex-wrap gap-3">
        {failedWrite ? (
          <button
            type="button"
            className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50"
            disabled={pending}
            onClick={onRetryWrite}
          >
            Retry write
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50"
            disabled={pending}
            onClick={() => onApprove(editing ? draft : undefined)}
          >
            Approve & next
          </button>
        )}
        {proposal.kind === "non_connect" && !failedWrite ? (
          <>
            <button
              type="button"
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
              disabled={pending}
              onClick={() => onApprove({ ...proposal.proposedFields, call_status: "Retry" })}
            >
              Retry
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
              disabled={pending}
              onClick={onSkip}
            >
              Skip
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
          disabled={pending}
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? "Hide edit" : "Edit"}
        </button>
        {proposal.kind === "connected" ? (
          <button
            type="button"
            className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
            disabled={pending}
            onClick={onRetryProcessing}
          >
            Retry processing
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md border border-red-300 bg-white px-4 py-2 font-medium text-red-800 disabled:opacity-50"
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
    </section>
  );
}
