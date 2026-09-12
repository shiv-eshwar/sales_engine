import { useEffect, useState } from "react";
import { Modal } from "@heroui/react";
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
  const needsSheet = mode === "new"
    ? !sheetConfirmed
    : Boolean(mode === "edit" && campaign && !campaign.spreadsheetId && !sheetConfirmed);

  useEffect(() => {
    if (!open) return undefined;
    setRequestId(crypto.randomUUID());
    setSheetConfirmed(mode === "edit" && Boolean(campaign?.spreadsheetId));
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
          <Modal.Dialog
            className={`flex flex-col rounded-lg ${needsSheet ? "h-auto max-h-[min(80vh,40rem)]" : "h-[min(86vh,760px)]"}`}
            aria-label={mode === "edit" ? "Edit offering" : needsSheet ? EMPTY_COPY.sheetConnect.title : "Create a campaign"}
          >
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="pr-8">
            <Modal.Heading>
              {mode === "edit"
                ? (campaign ? `Editing ${campaign.name}` : "Edit offering")
                : needsSheet
                  ? EMPTY_COPY.sheetConnect.title
                  : "Create a campaign"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {needsSheet ? null : (
              <p className="mb-4 max-w-[32em] shrink-0 text-sm leading-relaxed text-muted">
                Chat with the campaign assistant. It will interview you and produce the calling strategy — there is no form to fill.
              </p>
            )}
            {open && needsSheet ? (
              <SheetConnect
                sheet={boundSheet}
                requestId={requestId}
                campaignId={mode === "edit" ? campaign?.id : undefined}
                onBusy={onBusy}
                onBound={async (next) => {
                  setBoundSheet(next);
                  if (mode === "edit") await onSheetBound?.();
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
