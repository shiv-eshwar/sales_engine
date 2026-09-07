import { useEffect, useState } from "react";
import type { CampaignLead } from "../../shared/campaigns";
import { assignCampaignLeads, fetchCampaignLeads } from "../state/api";

export function CampaignLeads({ campaignId, onChanged, onBusy }: {
  campaignId: string; onChanged: () => Promise<void>; onBusy: (busy: boolean) => void;
}) {
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchCampaignLeads(campaignId, controller.signal).then(result => setLeads(result.leads)).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load leads");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [campaignId, attempt]);
  async function assign(leadIds: string[], assigned: boolean) {
    const previous = leads;
    let saved = false;
    setPending(true); onBusy(true); setError(null);
    setLeads(current => current.map(lead => leadIds.includes(lead.leadId) ? { ...lead, assigned } : lead));
    try {
      await assignCampaignLeads(campaignId, leadIds, assigned);
      saved = true;
      await onChanged();
    } catch (err) {
      if (!saved) setLeads(previous);
      setError(err instanceof Error ? err.message : "Could not update lead assignment");
    } finally { setPending(false); onBusy(false); }
  }
  const visible = leads.filter(lead => `${lead.fullName} ${lead.company} ${lead.role} ${lead.sheetCampaign}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5" aria-label="Campaign leads">
      <h2 className="text-base font-semibold">Assign leads to this campaign</h2>
      <p className="mt-1 text-sm text-slate-600">Choose eligible contacts for this offering. Assignment is saved in the app; your Sheet’s Campaign column stays under your control.</p>
      <input aria-label="Search campaign leads" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, company, role, or Sheet tag" className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      {loading ? <p role="status" className="mt-3 text-sm">Loading leads…</p> : <>
        <p className="mt-3 text-xs text-slate-500">{leads.filter(lead => lead.assigned).length} assigned · {leads.length} eligible in the Sheet</p>
        <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-slate-100">
          {visible.map(lead => <label key={lead.leadId} className="flex cursor-pointer items-start gap-3 py-3 text-sm">
            <input type="checkbox" checked={lead.assigned} disabled={pending} className="mt-1" onChange={e => { void assign([lead.leadId], e.target.checked); }} />
            <span><span className="font-medium">{lead.fullName || lead.leadId}</span> · {lead.company}
              <span className="block text-xs text-slate-500">{lead.role}{lead.sheetCampaign ? ` · Sheet tag: ${lead.sheetCampaign}` : ""}</span>
            </span>
          </label>)}
          {!visible.length ? <p className="py-3 text-sm text-slate-600">No matching eligible leads.</p> : null}
        </div>
        {visible.some(lead => !lead.assigned) ? <button type="button" disabled={pending} className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" onClick={() => { void assign(visible.filter(lead => !lead.assigned).map(lead => lead.leadId).slice(0, 1000), true); }}>Assign all shown</button> : null}
      </>}
      {error ? <div className="mt-3 text-sm text-red-700" role="alert">{error} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Retry loading</button></div> : null}
    </section>
  );
}
