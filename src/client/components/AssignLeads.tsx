import { useEffect, useState } from "react";
import type { CampaignLead } from "../../shared/campaigns";
import { assignCampaignLeads, fetchCampaignLeads } from "../state/api";

export function AssignLeads({
  campaignId,
  disabled,
  onAssigned
}: {
  campaignId: string;
  disabled?: boolean;
  onAssigned: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<CampaignLead[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setError(null);
    setLeads(null);
    void fetchCampaignLeads(campaignId, controller.signal)
      .then((result) => {
        setLeads(result.leads);
        setSelected(new Set(result.leads.filter((lead) => lead.assigned).map((lead) => lead.leadId)));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Could not load assignable leads");
        }
      });
    return () => controller.abort();
  }, [open, campaignId]);

  async function save() {
    if (!leads) return;
    setPending(true);
    setError(null);
    try {
      const assigned = leads.filter((lead) => selected.has(lead.leadId)).map((lead) => lead.leadId);
      const removed = leads.filter((lead) => lead.assigned && !selected.has(lead.leadId)).map((lead) => lead.leadId);
      if (assigned.length) await assignCampaignLeads(campaignId, assigned, true);
      if (removed.length) await assignCampaignLeads(campaignId, removed, false);
      await onAssigned();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign leads");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || pending}
        className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide assign leads" : "Assign leads"}
      </button>
      {open ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4" aria-label="Assign leads">
          <p className="text-sm text-slate-600">
            Choose eligible Sheet contacts for this campaign. Assignment stays in this app and does not change the
            Sheet’s Campaign column.
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {leads === null && !error ? <p className="mt-3 text-sm text-slate-500">Loading contacts…</p> : null}
          {leads && leads.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No eligible Sheet contacts to assign.</p>
          ) : null}
          {leads && leads.length > 0 ? (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
              {leads.map((lead) => (
                <li key={lead.leadId}>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.leadId)}
                      disabled={pending}
                      onChange={() => {
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(lead.leadId)) next.delete(lead.leadId);
                          else next.add(lead.leadId);
                          return next;
                        });
                      }}
                    />
                    <span>
                      <span className="font-medium">{lead.fullName || lead.leadId}</span>
                      {lead.company ? <span className="text-slate-600"> · {lead.company}</span> : null}
                      {lead.role ? <span className="text-slate-500"> · {lead.role}</span> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending || !leads}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void save()}
            >
              {pending ? "Saving…" : "Save assignments"}
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
