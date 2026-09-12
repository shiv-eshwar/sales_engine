import { useEffect, type RefObject } from "react";
import type { PublicCampaign, PublicLead } from "../../shared/contracts";

export function ReadyContactCard({
  lead,
  campaign,
  opening,
  firstQuestion,
  disabledReason,
  starting,
  pending,
  callError,
  sheetBlocking,
  onCall,
  onSkip,
  onRefresh,
  callButtonRef
}: {
  lead: PublicLead;
  campaign?: PublicCampaign;
  opening: string | null;
  firstQuestion: string | null;
  disabledReason: string | null;
  starting: boolean;
  pending: boolean;
  callError: string | null;
  sheetBlocking: boolean;
  onCall: () => void;
  onSkip: () => void;
  onRefresh: () => void;
  callButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  useEffect(() => {
    if (sheetBlocking || disabledReason || starting) return;
    callButtonRef?.current?.focus();
  }, [callButtonRef, disabledReason, sheetBlocking, starting, lead.leadId]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Next contact">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Next up</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{lead.fullName || "Unnamed contact"}</h1>
      <p className="text-sm text-slate-700">
        {lead.role}
        {lead.role && lead.company ? " · " : ""}
        {lead.company}
      </p>
      <p className="mt-2 font-mono text-sm">
        {lead.phoneE164 ?? lead.phone}
        {lead.dialable ? "" : " — not dialable"}
      </p>
      {campaign ? (
        <p className="mt-3 text-sm text-slate-800">
          {campaign.objective}
          {campaign.brief ? <span className="mt-1 block text-xs text-slate-500">Strategy v{campaign.version}</span> : null}
        </p>
      ) : null}
      {opening ? (
        <div className="mt-4 rounded-md bg-slate-50 p-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Opening</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">{opening}</p>
        </div>
      ) : null}
      {firstQuestion ? (
        <p className="mt-3 text-sm text-slate-800">
          <span className="font-medium">First question: </span>
          {firstQuestion}
        </p>
      ) : null}
      {lead.issues.length > 0 ? (
        <ul className="mt-3 text-sm text-red-700">
          {lead.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      {callError ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {callError}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {sheetBlocking ? null : (
          <button
            ref={callButtonRef}
            type="button"
            disabled={Boolean(disabledReason) || pending || starting}
            title={disabledReason ?? "Start a call"}
            className="rounded-md bg-emerald-700 px-8 py-3 text-lg font-semibold text-white disabled:bg-slate-300 disabled:text-slate-600"
            onClick={onCall}
          >
            {starting ? "Calling…" : "Call"}
          </button>
        )}
        <button
          type="button"
          disabled={pending || starting}
          className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
          onClick={onSkip}
        >
          Skip
        </button>
        <button
          type="button"
          disabled={pending || starting}
          title="Re-read the lead queue from the sheet"
          className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium disabled:opacity-50"
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>
      {disabledReason ? <p className="mt-2 text-sm text-slate-600">{disabledReason}</p> : null}
    </section>
  );
}
