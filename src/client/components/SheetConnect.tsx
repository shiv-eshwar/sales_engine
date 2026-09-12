import { useState } from "react";
import { Alert, Button } from "@heroui/react";
import type { SheetInfo } from "../../shared/contracts";
import { EMPTY_COPY } from "../copy";
import { createLeadsSheet, linkLeadsSheet } from "../state/api";

const choiceClass =
  "flex w-full flex-col gap-2 rounded-lg bg-surface p-4 text-left shadow-sm hover:bg-surface-secondary disabled:opacity-50";
const fieldClass = "flex flex-col gap-2";
const inputClass = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground";
const quietLinkClass = "text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4";

export function SheetConnect({
  sheet,
  requestId,
  campaignId,
  onBusy,
  onBound
}: {
  sheet: SheetInfo;
  requestId: string;
  campaignId?: string;
  onBusy: (busy: boolean) => void;
  onBound: (next: SheetInfo) => Promise<void>;
}) {
  const copy = EMPTY_COPY.sheetConnect;
  const [mode, setMode] = useState<"choose" | "link" | "create">("choose");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("Sales Engine Leads");
  const [shareEmail, setShareEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const sampleAvailable = sheet.backend === "memory";
  const googleReady = sheet.manageable;
  const target = { requestId, campaignId };

  async function run(action: () => Promise<SheetInfo>) {
    setPending(true);
    onBusy(true);
    setError(null);
    try {
      await onBound(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect the Sheet.");
    } finally {
      setPending(false);
      onBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto">
      <p className="max-w-[32em] text-sm leading-relaxed text-muted">{copy.description}</p>
      {error ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {!googleReady && !sampleAvailable ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{copy.googleMissing}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {mode === "choose" ? (
        <div className="flex flex-col gap-3">
          {sampleAvailable ? (
            <div className="flex w-full flex-col gap-2 rounded-lg bg-surface p-4 text-left shadow-sm">
              <p className="font-semibold">{copy.sampleLeads}</p>
              <p className="text-sm leading-relaxed text-muted">{copy.sampleLeadsHint}</p>
              <div className="pt-1">
                <Button
                  className="rounded-lg!"
                  isDisabled={pending}
                  isPending={pending}
                  onPress={() => {
                    void run(async () => (await createLeadsSheet({ title, ...target })).sheet);
                  }}
                >
                  {copy.sampleLeads}
                </Button>
              </div>
            </div>
          ) : null}
          {googleReady ? (
            <>
              <button type="button" className={choiceClass} disabled={pending} onClick={() => setMode("link")}>
                <span className="font-semibold">{copy.linkExisting}</span>
                <span className="text-sm leading-relaxed text-muted">
                  Use a spreadsheet you already keep leads in.
                </span>
              </button>
              <button type="button" className={choiceClass} disabled={pending} onClick={() => setMode("create")}>
                <span className="font-semibold">{copy.createNew}</span>
                <span className="text-sm leading-relaxed text-muted">
                  Create one with the Sales Engine headers.
                </span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {mode === "link" && googleReady ? (
        <form
          className="flex max-w-lg flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => (await linkLeadsSheet(url, target)).sheet);
          }}
        >
          <label className={fieldClass} htmlFor="sheet-url">
            <span className="text-sm font-semibold">{copy.urlLabel}</span>
            <input
              id="sheet-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={copy.urlPlaceholder}
              autoComplete="off"
              className={inputClass}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="rounded-lg!" isDisabled={pending || url.trim().length < 8} isPending={pending}>
              {copy.linkAction}
            </Button>
            <button type="button" className={quietLinkClass} disabled={pending} onClick={() => setMode("choose")}>
              Back
            </button>
          </div>
        </form>
      ) : null}

      {mode === "create" && googleReady ? (
        <form
          className="flex max-w-lg flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => (await createLeadsSheet({
              title,
              shareEmail: shareEmail.trim() || undefined,
              ...target
            })).sheet);
          }}
        >
          <label className={fieldClass} htmlFor="sheet-title">
            <span className="text-sm font-semibold">{copy.titleLabel}</span>
            <input
              id="sheet-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={fieldClass} htmlFor="sheet-email">
            <span className="text-sm font-semibold">{copy.shareLabel}</span>
            <input
              id="sheet-email"
              type="email"
              value={shareEmail}
              onChange={(event) => setShareEmail(event.target.value)}
              className={inputClass}
            />
            <span className="text-sm text-muted">{copy.shareHint}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="rounded-lg!" isDisabled={pending || title.trim().length < 1} isPending={pending}>
              {copy.createAction}
            </Button>
            <button type="button" className={quietLinkClass} disabled={pending} onClick={() => setMode("choose")}>
              Back
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
