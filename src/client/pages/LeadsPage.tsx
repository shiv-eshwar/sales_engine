import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../state/session";
import { refreshLeads } from "../state/api";
import { DailySummaryPanel } from "../components/DailySummaryPanel";
import { LeadsTable, filterLeads, sortLeads, type LeadSortKey } from "../components/LeadsTable";

export function LeadsPage() {
  const { data, pending, campaignBusy, runQueue, setEditor } = useSession();
  const [query, setQuery] = useState("");
  const [dialableOnly, setDialableOnly] = useState(false);
  const [sortKey, setSortKey] = useState<LeadSortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const visible = useMemo(() => {
    const filtered = filterLeads(data.leads, query, dialableOnly);
    return sortLeads(filtered, sortKey, sortDir);
  }, [data.leads, query, dialableOnly, sortKey, sortDir]);

  const campaign = data.campaigns.find((item) => item.id === data.selectedCampaignId) ?? data.campaigns[0];

  function toggleSort(key: LeadSortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-600">
            {campaign ? (
              <>Selling <strong>{campaign.brief?.offeringName ?? campaign.name}</strong> · {data.leads.length} eligible</>
            ) : (
              "Create a campaign to start preparing calls."
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
          <button
            type="button"
            disabled={pending || campaignBusy}
            title="Re-read the lead queue from the sheet"
            className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => void runQueue(() => refreshLeads(data.selectedCampaignId))}
          >
            Reload from sheet
          </button>
        </div>
      </header>

      {data.ai.status !== "ok" ? <p role="status" className="mt-3 text-sm text-amber-800">{data.ai.message}</p> : null}
      {data.research.status !== "ok" && data.ai.status === "ok" ? <p className="mt-3 text-sm text-amber-800">{data.research.message}</p> : null}
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

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4" aria-label="Find leads">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex-1 min-w-52 text-sm">
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
            Dialable only
          </label>
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
          Showing {visible.length} of {data.leads.length} eligible leads. Select a row to open the brief and call.
        </p>
        <LeadsTable leads={visible} />
      </section>

      <DailySummaryPanel summary={data.summary} />
    </div>
  );
}
