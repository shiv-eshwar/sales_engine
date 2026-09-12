import { useEffect, useState } from "react";
import { Button, Modal } from "@heroui/react";
import type { PublicCampaign, SheetInfo } from "../../shared/contracts";
import { EMPTY_COPY } from "../copy";
import { CampaignChat } from "./CampaignChat";
import { SheetConnect } from "./SheetConnect";

export function CampaignDrawer({
  mode,
  campaign,
  sheet,
  onClose,
  onSaved,
  onBusy,
  onSheetBound,
  aiMessage
}: {
  mode: "new" | "edit" | null;
  campaign?: PublicCampaign;
  sheet: SheetInfo;
  onClose: () => void;
  onSaved: (campaign: PublicCampaign) => Promise<void>;
  onBusy: (busy: boolean) => void;
  onSheetBound?: () => Promise<void>;
  aiMessage?: string;
}) {
  const open = mode !== null;
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [sheetConfirmed, setSheetConfirmed] = useState(false);
  const [boundSheet, setBoundSheet] = useState(sheet);
  const needsSheet = mode === "new" && !sheetConfirmed;

  useEffect(() => {
    if (!open) return undefined;
    setRequestId(crypto.randomUUID());
    setSheetConfirmed(mode === "edit");
    setBoundSheet(sheet);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
    // sheet is read only when the drawer opens; later binds update boundSheet locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, campaign?.id]);

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Modal.Container size="lg">
        <Modal.Dialog className="flex h-[min(86vh,760px)] flex-col" aria-label={mode === "edit" ? "Edit offering" : needsSheet ? EMPTY_COPY.sheetConnect.title : "Create a campaign"}>
          <Modal.Header>
            <Modal.Heading>
              {mode === "edit"
                ? (campaign ? `Editing ${campaign.name}` : "Edit offering")
                : needsSheet
                  ? EMPTY_COPY.sheetConnect.title
                  : "Create a campaign"}
            </Modal.Heading>
            <Button variant="ghost" size="sm" onPress={onClose} aria-label="Close">
              Close
            </Button>
          </Modal.Header>
          <Modal.Body className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {needsSheet ? null : (
              <p className="text-muted mb-3 shrink-0 text-sm">
                Chat with the campaign assistant. It will interview you and produce the calling strategy — there is no form to fill.
              </p>
            )}
            {open && needsSheet ? (
              <SheetConnect
                sheet={boundSheet}
                onBusy={onBusy}
                onContinueCurrent={() => setSheetConfirmed(true)}
                onBound={async (next) => {
                  setBoundSheet(next);
                  await onSheetBound?.();
                  setSheetConfirmed(true);
                }}
              />
            ) : null}
            {open && !needsSheet ? (
              <div className="min-h-0 flex-1">
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
