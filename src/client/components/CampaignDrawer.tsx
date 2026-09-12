import { useEffect, useState } from "react";
import { Button, Modal } from "@heroui/react";
import type { PublicCampaign } from "../../shared/contracts";
import { CampaignChat } from "./CampaignChat";

export function CampaignDrawer({
  mode,
  campaign,
  onClose,
  onSaved,
  onBusy,
  aiMessage
}: {
  mode: "new" | "edit" | null;
  campaign?: PublicCampaign;
  onClose: () => void;
  onSaved: (campaign: PublicCampaign) => Promise<void>;
  onBusy: (busy: boolean) => void;
  aiMessage?: string;
}) {
  const open = mode !== null;
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return undefined;
    setRequestId(crypto.randomUUID());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mode, campaign?.id]);

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Modal.Container size="lg">
        <Modal.Dialog className="flex max-h-[min(86vh,760px)] flex-col" aria-label={mode === "edit" ? "Edit offering" : "Create a campaign"}>
          <Modal.Header>
            <Modal.Heading>
              {mode === "edit" ? (campaign ? `Editing ${campaign.name}` : "Edit offering") : "Create a campaign"}
            </Modal.Heading>
            <Button variant="ghost" size="sm" onPress={onClose} aria-label="Close">
              Close
            </Button>
          </Modal.Header>
          <Modal.Body className="flex min-h-0 flex-1 flex-col">
            <p className="mb-3 text-sm text-muted">
              Chat with the campaign assistant. It will interview you and produce the calling strategy — there is no form to fill.
            </p>
            {open ? (
              <div className="min-h-[28rem] flex-1">
                <CampaignChat
                  key={`${mode}-${campaign?.id ?? "new"}-${requestId}`}
                  campaign={mode === "edit" ? campaign : undefined}
                  requestId={requestId}
                  onBusy={onBusy}
                  aiMessage={aiMessage}
                  onSaved={onSaved}
                />
              </div>
            ) : null}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
