import { useState } from "react";
import { campaignBriefSchema, type CampaignBrief } from "../../shared/campaigns";
import type { PublicCampaign } from "../../shared/contracts";
import { saveCampaign } from "../state/api";

const emptyBrief: CampaignBrief = {
  offeringName: "", offeringDescription: "", targetCustomer: "", objective: "",
  type: "sales", website: "", approvedFacts: [], sheetCampaignValue: ""
};
const fieldClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60";

export function CampaignEditor({ campaign, onSaved, onCancel, onBusy, aiMessage }: {
  campaign?: PublicCampaign;
  onSaved: (campaign: PublicCampaign) => Promise<void>;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
  aiMessage?: string;
}) {
  const [brief, setBrief] = useState<CampaignBrief>(campaign?.brief ?? emptyBrief);
  const [facts, setFacts] = useState(brief.approvedFacts.join("\n"));
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function change<K extends keyof CampaignBrief>(key: K, value: CampaignBrief[K]) {
    setBrief(current => ({ ...current, [key]: value }));
    setRequestId(crypto.randomUUID());
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = campaignBriefSchema.safeParse({ ...brief, approvedFacts: facts.split("\n").map(line => line.trim()).filter(Boolean) });
    if (!parsed.success) {
      setError(parsed.error.issues.map(issue => `${issue.path.join(" ")}: ${issue.message}`).join(" "));
      return;
    }
    setPending(true);
    onBusy(true);
    setError(null);
    try {
      const saved = await saveCampaign(parsed.data, requestId, campaign);
      await onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Campaign generation failed. Try again.");
    } finally {
      setPending(false);
      onBusy(false);
    }
  }
  return (
    <div aria-label="Campaign setup">
      <p className="text-sm text-slate-600">Describe what you’re selling and to whom. AI will create the campaign name, approach, discovery questions, and qualification criteria.</p>
      <form className="mt-4" onSubmit={event => { void submit(event); }}>
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Product or service
            <input required maxLength={160} className={fieldClass} value={brief.offeringName} onChange={e => change("offeringName", e.target.value)} />
          </label>
          <label className="text-sm font-medium">Conversation goal
            <select className={fieldClass} value={brief.type} onChange={e => change("type", e.target.value as CampaignBrief["type"])}>
              <option value="sales">Sales discovery</option><option value="research">Customer research</option><option value="networking">Professional networking</option>
            </select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">What does it do, and what problem does it address?
            <textarea required maxLength={6000} rows={3} className={fieldClass} value={brief.offeringDescription} onChange={e => change("offeringDescription", e.target.value)} />
          </label>
          <label className="text-sm font-medium">Target customers and roles
            <textarea required maxLength={2000} rows={3} className={fieldClass} value={brief.targetCustomer} onChange={e => change("targetCustomer", e.target.value)} />
          </label>
          <label className="text-sm font-medium">Desired outcome of the call
            <textarea required maxLength={2000} rows={3} className={fieldClass} value={brief.objective} onChange={e => change("objective", e.target.value)} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Approved product facts — one per line
            <textarea maxLength={36000} rows={3} className={fieldClass} value={facts} onChange={e => { setFacts(e.target.value); setRequestId(crypto.randomUUID()); }} />
            <span className="mt-1 block text-xs font-normal text-slate-600">Capabilities, pricing, evidence, or limitations the caller may state. AI must not invent product proof.</span>
          </label>
          <label className="text-sm font-medium">Product website (optional)
            <input type="url" maxLength={2000} className={fieldClass} value={brief.website} onChange={e => change("website", e.target.value)} />
          </label>
          <label className="text-sm font-medium">Sheet campaign tag (optional)
            <input maxLength={160} className={fieldClass} value={brief.sheetCampaignValue} onChange={e => change("sheetCampaignValue", e.target.value)} />
            <span className="mt-1 block text-xs font-normal text-slate-600">Match an existing Campaign value in your Sheet, or use Assign leads after creating the campaign.</span>
          </label>
        </fieldset>
        {aiMessage ? <p className="mt-3 text-sm text-amber-800">{aiMessage}</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex items-center gap-3">
          <button
            disabled={pending || Boolean(aiMessage)}
            aria-disabled={pending || Boolean(aiMessage)}
            className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100"
            type="submit"
          >
            {pending ? "Generating campaign…" : campaign ? "Save & regenerate" : "Generate campaign"}
          </button>
          <button disabled={pending} className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="button" onClick={onCancel}>Cancel</button>
          {pending ? <p role="status" className="text-sm text-slate-600">Creating your strategy. This may take a minute.</p> : null}
        </div>
      </form>
    </div>
  );
}
