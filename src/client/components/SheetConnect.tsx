import { useState } from "react";
import { Alert, Button, Card } from "@heroui/react";
import type { SheetInfo } from "../../shared/contracts";
import { EMPTY_COPY } from "../copy";
import { createLeadsSheet, linkLeadsSheet } from "../state/api";

export function SheetConnect({
  sheet,
  onBusy,
  onBound,
  onContinueCurrent
}: {
  sheet: SheetInfo;
  onBusy: (busy: boolean) => void;
  onBound: (next: SheetInfo) => Promise<void>;
  onContinueCurrent: () => void;
}) {
  const copy = EMPTY_COPY.sheetConnect;
  const [mode, setMode] = useState<"choose" | "link" | "create">(sheet.status === "ok" ? "choose" : "choose");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("Sales Engine Leads");
  const [shareEmail, setShareEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const currentReady = sheet.status === "ok";

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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <p className="text-muted text-sm leading-relaxed">{copy.description}</p>
      {error ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {!sheet.manageable ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{copy.googleMissing}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {currentReady ? (
        <Card>
          <Card.Header>
            <Card.Title>Current Sheet</Card.Title>
            <Card.Description>
              {sheet.sheetName ? `${sheet.sheetName}` : "Leads"}
              {sheet.spreadsheetId ? ` · ${sheet.spreadsheetId}` : ""}
              {sheet.backend === "memory" ? " · sample leads" : ""}
            </Card.Description>
          </Card.Header>
          <Card.Footer>
            <Button onPress={onContinueCurrent} isDisabled={pending}>
              {copy.continueCurrent}
            </Button>
            {sheet.url ? (
              <a href={sheet.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-2">
                Open in Google
              </a>
            ) : null}
          </Card.Footer>
        </Card>
      ) : null}

      {mode === "choose" || !sheet.manageable ? (
        <div className="flex flex-wrap gap-2">
          {sheet.manageable ? (
            <>
              <Button variant={currentReady ? "outline" : "primary"} isDisabled={pending} onPress={() => setMode("link")}>
                {copy.linkExisting}
              </Button>
              <Button variant="outline" isDisabled={pending} onPress={() => setMode("create")}>
                {copy.createNew}
              </Button>
            </>
          ) : currentReady ? null : (
            <p className="text-muted text-sm">{copy.googleMissing}</p>
          )}
        </div>
      ) : null}

      {mode === "link" && sheet.manageable ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => (await linkLeadsSheet(url)).sheet);
          }}
        >
          <label className="text-sm font-medium" htmlFor="sheet-url">
            {copy.urlLabel}
          </label>
          <input
            id="sheet-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={copy.urlPlaceholder}
            autoComplete="off"
            className="border-separator bg-surface w-full rounded-md border px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" isDisabled={pending || url.trim().length < 8} isPending={pending}>
              {copy.linkAction}
            </Button>
            <Button variant="ghost" type="button" isDisabled={pending} onPress={() => setMode("choose")}>
              Back
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "create" && sheet.manageable ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => (await createLeadsSheet({
              title,
              shareEmail: shareEmail.trim() || undefined
            })).sheet);
          }}
        >
          <label className="text-sm font-medium" htmlFor="sheet-title">
            {copy.titleLabel}
          </label>
          <input
            id="sheet-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="border-separator bg-surface w-full rounded-md border px-3 py-2 text-sm"
          />
          <label className="text-sm font-medium" htmlFor="sheet-email">
            {copy.shareLabel}
          </label>
          <input
            id="sheet-email"
            type="email"
            value={shareEmail}
            onChange={(event) => setShareEmail(event.target.value)}
            className="border-separator bg-surface w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-muted text-xs leading-relaxed">{copy.shareHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" isDisabled={pending || title.trim().length < 1} isPending={pending}>
              {copy.createAction}
            </Button>
            <Button variant="ghost" type="button" isDisabled={pending} onPress={() => setMode("choose")}>
              Back
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
