import { useEffect } from "react";
import type { PublicCampaign } from "../../shared/contracts";
import { CampaignEditor } from "./CampaignEditor";

export function CampaignDrawer({ mode, campaign, onClose, onSaved, onBusy, aiMessage }: {
  mode: "new" | "edit" | null;
  campaign?: PublicCampaign;
  onClose: () => void;
  onSaved: (campaign: PublicCampaign) => Promise<void>;
  onBusy: (busy: boolean) => void;
  aiMessage?: string;
}) {
  const open = mode !== null;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={mode === "edit" ? "Edit offering" : "Create a campaign"}>
      <button
        type="button"
        aria-label="Close campaign panel"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/50"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
              {mode === "edit" ? "Edit offering" : "New campaign"}
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {mode === "edit" ? (campaign ? `Editing ${campaign.name}` : "Edit offering") : "Create a campaign"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Close
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <CampaignEditor
            key={mode === "edit" ? `${campaign?.id}-${campaign?.version}` : "new"}
            campaign={mode === "edit" ? campaign : undefined}
            onBusy={onBusy}
            aiMessage={aiMessage}
            onCancel={onClose}
            onSaved={onSaved}
          />
        </div>
      </aside>
    </div>
  );
}
