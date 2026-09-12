import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../state/session";
import { DailySummaryPanel } from "../components/DailySummaryPanel";
import { LeadsTable, filterLeads, sortLeads, type LeadSortKey } from "../components/LeadsTable";
import { ReadyContactCard } from "../components/ReadyContactCard";
import { AssignLeads } from "../components/AssignLeads";
import { CallingPanel } from "../components/CallingPanel";
import { AI_DISCONNECTED_COPY } from "../copy";
import { useLeadCall } from "../state/useLeadCall";

export function LeadsPage() {
  const { data, pending, campaignBusy, setEditor, refresh } = useSession();
  const [query, setQuery] = useState("");
  const [dialableOnly, setDialableOnly] = useState(true);
  const [sortKey, setSortKey] = useState<LeadSortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const callButtonRef = useRef<HTMLButtonElement>(null);

  const nextLead = data.leads.find((item) => item.dialable) ?? null;
  const {
    campaign, call, setCall, callError, starting, disabledReason, sheetBlocking,
    opening, firstQuestion, onCall, onSkip, onRefresh, openReview
  } = useLeadCall(nextLead);

  const visible = useMemo(() => {
    const filtered = filterLeads(data.leads, query, dialableOnly);
    return sortLeads(filtered, sortKey, sortDir);
  }, [data.leads, query, dialableOnly, sortKey, sortDir]);

  const undialableCount = data.leads.filter((lead) => !lead.dialable).length;
  const hasFilter = query.trim().length > 0 || dialableOnly;

  function toggleSort(key: LeadSortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  if (call) {
    return (
      <CallingPanel
        session={call}
        recordingNotice={data.recordingNotice}
        onSession={setCall}
        onTerminal={() => void openReview(call.id)}
      />
    );
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {nextLead ? (
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Ready</p>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">Ready</h1>
          )}
          <p className="text-sm text-slate-600">
            {campaign ? (
              <>Selling <strong>{campaign.brief?.offeringName ?? campaign.name}</strong> · {data.leads.length} eligible</>
            ) : (
              "Create a campaign to start calling — AI generation is optional."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign?.brief ? (
            <button
              type="button"
              disabled={pending || campaignBusy}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
              onClick={() => setEditor("edit")}
            >
              Edit offering
            </button>
          ) : null}
          {campaign ? (
            <AssignLeads
              campaignId={campaign.id}
              disabled={pending || campaignBusy}
              onAssigned={async () => {
                await refresh();
              }}
            />
          ) : null}
          <button
            type="button"
            disabled={pending || campaignBusy}
            title="Re-read the lead queue from the sheet"
            className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
            onClick={onRefresh}
          >
            Refresh
          </button>
        </div>
      </header>

      {data.ai.status !== "ok" ? (
        <p role="status" className="mt-3 text-sm text-amber-800">
          {data.ai.message.includes("LLM_") ? AI_DISCONNECTED_COPY : data.ai.message}
        </p>
      ) : null}
      {data.research.status !== "ok" && data.ai.status === "ok" ? (
        <p className="mt-3 text-sm text-amber-800">{data.research.message}</p>
      ) : null}
      {data.pendingProposal ? (
        <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Review waiting for {data.pendingProposal.contactName || data.pendingProposal.leadId}.{" "}
          <Link
            to={`/calls/${encodeURIComponent(data.pendingProposal.sessionId)}/review`}
            className="font-medium underline underline-offset-2"
          >
            Open review
          </Link>
        </p>
      ) : null}

      {!campaign ? (
        <section className="mt-6 max-w-xl rounded-xl border border-slate-200 bg-white p-6" aria-label="Create a campaign">
          <h2 className="text-lg font-semibold">Create a campaign</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pick a YAML campaign the operator already has, or create a new offering. You do not need AI connected to
            call an existing campaign.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => setEditor("new")}
          >
            Create a campaign
          </button>
        </section>
      ) : nextLead ? (
        <div className="mt-5">
          <ReadyContactCard
            lead={nextLead}
            campaign={campaign}
            opening={opening}
            firstQuestion={firstQuestion}
            disabledReason={disabledReason}
            starting={starting}
            pending={pending}
            callError={callError}
            sheetBlocking={sheetBlocking}
            onCall={() => void onCall()}
            onSkip={() => void onSkip()}
            onRefresh={onRefresh}
            callButtonRef={callButtonRef}
          />
        </div>
      ) : (
        <section className="mt-6 max-w-xl rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">No one is ready to call</h2>
          <p className="mt-2 text-sm text-slate-600">
            Assign eligible Sheet contacts to this campaign, or fix phone numbers that cannot be dialed.
          </p>
        </section>
      )}

      {campaign ? (
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4" aria-label="All leads">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">All leads</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="min-w-52 flex-1 text-sm">
              <span className="sr-only">Search leads</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, company, phone…"
                aria-label="Search leads"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={dialableOnly}
                onChange={(event) => setDialableOnly(event.target.checked)}
              />
              Ready to call
            </label>
            {undialableCount > 0 ? (
              <button
                type="button"
                className="text-sm text-slate-600 underline"
                onClick={() => setDialableOnly(false)}
              >
                {undialableCount} need a phone fix
              </button>
            ) : null}
            <div className="flex items-center gap-1 text-sm" role="group" aria-label="Sort leads">
              {([["name", "Name"], ["company", "Company"], ["status", "Status"]] as Array<[LeadSortKey, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSort(key)}
                  aria-pressed={sortKey === key}
                  className={`rounded-md border px-2.5 py-1.5 ${sortKey === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}
                >
                  {label}{sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500" aria-live="polite">
            Showing {visible.length} of {data.leads.length} eligible leads.
          </p>
          <LeadsTable
            leads={visible}
            emptyReason={
              visible.length === 0
                ? query.trim()
                  ? "No leads match this search."
                  : dialableOnly
                    ? "No dialable leads. Contacts that need a phone fix are hidden."
                    : "No eligible leads assigned to this campaign."
                : null
            }
            hasActiveFilter={hasFilter}
          />
        </section>
      ) : null}

      <DailySummaryPanel summary={data.summary} />
    </div>
  );
}
