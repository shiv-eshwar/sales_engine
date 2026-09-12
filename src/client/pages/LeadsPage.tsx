import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@heroui/react";
import { useSession } from "../state/session";
import { DailySummaryPanel } from "../components/DailySummaryPanel";
import { EmptyState } from "../components/EmptyState";
import { LeadsTable, filterLeads, sortLeads, type LeadSortKey } from "../components/LeadsTable";
import { ReadyContactCard } from "../components/ReadyContactCard";
import { CallingPanel } from "../components/CallingPanel";
import { AI_DISCONNECTED_COPY, EMPTY_COPY } from "../copy";
import { useLeadCall } from "../state/useLeadCall";

export function LeadsPage() {
  const { data, pending, campaignBusy, setEditor } = useSession();
  const [query, setQuery] = useState("");
  const [dialableOnly, setDialableOnly] = useState(true);
  const [sortKey, setSortKey] = useState<LeadSortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const callButtonRef = useRef<HTMLButtonElement>(null);

  const nextLead = data.leads.find((item) => item.dialable) ?? null;
  const {
    campaign, call, setCall, callError, starting, disabledReason, sheetBlocking,
    opening, firstQuestion, onCall, onSkip, onRefresh, openReview
  } = useLeadCall(nextLead);

  const visible = useMemo(() => {
    const filtered = filterLeads(data.leads, query, dialableOnly);
    return sortLeads(filtered, sortKey, sortDir);
  }, [data.leads, query, dialableOnly, sortKey, sortDir]);

  const undialableCount = data.leads.filter((lead) => !lead.dialable).length;
  const sheetUnconfigured = data.sheet.status === "error" || data.sheet.status === "unconfigured";
  const tableEmpty = visible.length === 0
    ? query.trim()
      ? EMPTY_COPY.search
      : dialableOnly
        ? EMPTY_COPY.dialableFilter
        : EMPTY_COPY.queue
    : null;

  function toggleSort(key: LeadSortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  if (call) {
    return (
      <CallingPanel
        session={call}
        recordingNotice={data.recordingNotice}
        onSession={setCall}
        onTerminal={() => void openReview(call.id)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {campaign ? (
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{nextLead ? "Ready" : null}</p>
            {nextLead ? null : <h1 className="text-2xl font-semibold tracking-tight">Ready</h1>}
            <p className="mt-1 text-sm text-muted">
              Selling {campaign.brief?.offeringName ?? campaign.name}
              {sheetUnconfigured ? "" : ` · ${data.leads.length} eligible`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {campaign.brief ? (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg!"
                isDisabled={pending || campaignBusy}
                onPress={() => setEditor("edit")}
              >
                Edit offering
              </Button>
            ) : null}
            <button type="button" className="text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4" disabled={pending || campaignBusy} onClick={onRefresh}>
              Refresh
            </button>
          </div>
        </header>
      ) : null}

      {data.ai.status !== "ok" ? (
        <Alert status="warning" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{data.ai.message.includes("LLM_") ? AI_DISCONNECTED_COPY : data.ai.message}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {data.research.status !== "ok" && data.ai.status === "ok" ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{data.research.message}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {data.pendingProposal ? (
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              Review waiting for {data.pendingProposal.contactName || data.pendingProposal.leadId}.{" "}
              <Link
                to={`/calls/${encodeURIComponent(data.pendingProposal.sessionId)}/review`}
                className="font-semibold underline underline-offset-2"
              >
                Open review
              </Link>
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {!campaign ? (
        <div className="pt-10">
          <EmptyState
            icon="campaign"
            title={EMPTY_COPY.campaign.title}
            description={EMPTY_COPY.campaign.description}
            action={<Button className="rounded-lg!" onPress={() => setEditor("new")}>Create a campaign</Button>}
          />
        </div>
      ) : sheetUnconfigured ? (
        <div className="pt-10">
          <EmptyState
            icon="sheet"
            title={EMPTY_COPY.sheet.title}
            description={data.sheet.message || EMPTY_COPY.sheet.description}
            action={
              <Button variant="outline" className="rounded-lg!" onPress={onRefresh}>
                Refresh
              </Button>
            }
          />
        </div>
      ) : nextLead ? (
        <ReadyContactCard
          lead={nextLead}
          campaign={campaign}
          opening={opening}
          firstQuestion={firstQuestion}
          disabledReason={disabledReason}
          starting={starting}
          pending={pending}
          callError={callError}
          sheetBlocking={sheetBlocking}
          onCall={() => void onCall()}
          onSkip={() => void onSkip()}
          onRefresh={onRefresh}
          callButtonRef={callButtonRef}
        />
      ) : data.leads.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon="leads"
            title={EMPTY_COPY.queue.title}
            description={EMPTY_COPY.queue.description}
            action={
              <Button variant="outline" className="rounded-lg!" onPress={onRefresh}>
                Refresh
              </Button>
            }
          />
        </div>
      ) : null}

      {campaign && !sheetUnconfigured && data.leads.length > 0 ? (
        <section className="pt-2" aria-label="All leads">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">All leads</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="min-w-52 flex-1 text-sm">
              <span className="sr-only">Search leads</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, company, phone…"
                aria-label="Search leads"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dialableOnly}
                onChange={(event) => setDialableOnly(event.target.checked)}
              />
              Ready to call
            </label>
            {undialableCount > 0 ? (
              <button type="button" className="text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4" onClick={() => setDialableOnly(false)}>
                {undialableCount} need a phone fix
              </button>
            ) : null}
            <div className="ml-auto flex items-center gap-1 text-sm" role="group" aria-label="Sort leads">
              {([["name", "Name"], ["company", "Company"], ["status", "Status"]] as Array<[LeadSortKey, string]>).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant="ghost"
                  aria-pressed={sortKey === key}
                  className={sortKey === key ? "rounded-lg! font-semibold text-foreground" : "rounded-lg!"}
                  onPress={() => toggleSort(key)}
                >
                  {label}{sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </Button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm text-muted" aria-live="polite">
            Showing {visible.length} of {data.leads.length} eligible leads.
          </p>
          <LeadsTable
            leads={visible}
            empty={
              tableEmpty ? (
                <EmptyState
                  compact
                  icon={query.trim() ? "search" : "leads"}
                  title={tableEmpty.title}
                  description={tableEmpty.description}
                  action={
                    query.trim() ? (
                      <Button variant="outline" size="sm" onPress={() => setQuery("")}>
                        Clear search
                      </Button>
                    ) : dialableOnly && undialableCount > 0 ? (
                      <Button variant="outline" size="sm" onPress={() => setDialableOnly(false)}>
                        Show contacts that need a phone fix
                      </Button>
                    ) : null
                  }
                />
              ) : null
            }
          />
        </section>
      ) : null}

      <DailySummaryPanel summary={data.summary} />
    </div>
  );
}
