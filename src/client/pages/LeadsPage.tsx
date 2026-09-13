import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@heroui/react";
import { useSession } from "../state/session";
import { EmptyState } from "../components/EmptyState";
import { LeadsTable, filterLeads, sortLeads, type LeadSortKey } from "../components/LeadsTable";
import { ReadyContactCard } from "../components/ReadyContactCard";
import { CallingPanel } from "../components/CallingPanel";
import { AI_DISCONNECTED_COPY, EMPTY_COPY } from "../copy";
import { useLeadCall } from "../state/useLeadCall";
import { SPLIT, SPLIT_PANE, SPLIT_RAIL } from "../layout/shell";

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
    preparation, opening, firstQuestion, preparing, onCall, onSkip, onRefresh, openReview
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
        preparation={preparation}
        opening={opening}
        firstQuestion={firstQuestion}
        onSession={setCall}
        onTerminal={() => void openReview(call.id)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5 lg:overflow-hidden">
      {!campaign ? (
        <div className="pt-6">
          <EmptyState
            icon="campaign"
            title={EMPTY_COPY.campaign.title}
            description={EMPTY_COPY.campaign.description}
            action={<Button className="rounded-lg!" onPress={() => setEditor("new")}>Create a campaign</Button>}
          />
        </div>
      ) : sheetUnconfigured ? (
        <div className="pt-6">
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
        <div className={SPLIT}>
          <div className={SPLIT_RAIL}>
            <ReadyContactCard
              lead={nextLead}
              campaign={campaign}
              opening={opening}
              firstQuestion={firstQuestion}
              preparing={preparing}
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
          </div>
          <div className={SPLIT_PANE}>
            <QueueAlerts
              aiStatus={data.ai.status}
              aiMessage={data.ai.message}
              researchStatus={data.research.status}
              researchMessage={data.research.message}
            />
            {data.leads.length > 0 ? (
              <LeadsQueue
                query={query}
                setQuery={setQuery}
                dialableOnly={dialableOnly}
                setDialableOnly={setDialableOnly}
                sortKey={sortKey}
                sortDir={sortDir}
                toggleSort={toggleSort}
                visible={visible}
                leadsCount={data.leads.length}
                undialableCount={undialableCount}
                tableEmpty={tableEmpty}
              />
            ) : null}
          </div>
        </div>
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
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <QueueAlerts
            aiStatus={data.ai.status}
            aiMessage={data.ai.message}
            researchStatus={data.research.status}
            researchMessage={data.research.message}
          />
          <LeadsQueue
            query={query}
            setQuery={setQuery}
            dialableOnly={dialableOnly}
            setDialableOnly={setDialableOnly}
            sortKey={sortKey}
            sortDir={sortDir}
            toggleSort={toggleSort}
            visible={visible}
            leadsCount={data.leads.length}
            undialableCount={undialableCount}
            tableEmpty={tableEmpty}
            onRefresh={onRefresh}
            refreshDisabled={pending || campaignBusy}
          />
        </div>
      )}
    </div>
  );
}

function QueueAlerts({
  aiStatus,
  aiMessage,
  researchStatus,
  researchMessage
}: {
  aiStatus: string;
  aiMessage: string;
  researchStatus: string;
  researchMessage: string;
}) {
  return (
    <>
      {aiStatus !== "ok" ? (
        <Alert status="warning" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{aiMessage.includes("LLM_") ? AI_DISCONNECTED_COPY : aiMessage}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {researchStatus !== "ok" && aiStatus === "ok" ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{researchMessage}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
    </>
  );
}

function LeadsQueue({
  query,
  setQuery,
  dialableOnly,
  setDialableOnly,
  sortKey,
  sortDir,
  toggleSort,
  visible,
  leadsCount,
  undialableCount,
  tableEmpty,
  onRefresh,
  refreshDisabled
}: {
  query: string;
  setQuery: (value: string) => void;
  dialableOnly: boolean;
  setDialableOnly: (value: boolean) => void;
  sortKey: LeadSortKey;
  sortDir: 1 | -1;
  toggleSort: (key: LeadSortKey) => void;
  visible: ReturnType<typeof filterLeads>;
  leadsCount: number;
  undialableCount: number;
  tableEmpty: { title: string; description: string } | null;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}) {
  return (
    <section aria-label="All leads" className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-1">
        <label className="min-w-0 flex-1 basis-48 text-sm">
          <span className="sr-only">Search leads</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, company, phone…"
            aria-label="Search leads"
            className="field-quiet w-full rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-[var(--field-placeholder)]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={dialableOnly}
              aria-label="Ready to call"
              className="size-3.5 accent-[var(--accent)]"
              onChange={(event) => setDialableOnly(event.target.checked)}
            />
            Ready
          </label>
          {undialableCount > 0 ? (
            <Link
              to="/notifications#queue"
              className="inline-flex min-h-11 items-center hover:text-foreground hover:underline hover:underline-offset-4"
            >
              {undialableCount} need a phone fix
            </Link>
          ) : null}
          <div className="flex items-center gap-0.5" role="group" aria-label="Sort leads">
            {([["name", "Name"], ["company", "Company"], ["status", "Status"]] as Array<[LeadSortKey, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={sortKey === key}
                className={`min-h-11 px-1.5 ${sortKey === key ? "font-semibold text-foreground" : "hover:text-foreground"}`}
                onClick={() => toggleSort(key)}
              >
                {label}{sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
              </button>
            ))}
          </div>
          {onRefresh ? (
            <button
              type="button"
              className="min-h-11 font-semibold hover:text-foreground hover:underline hover:underline-offset-4 disabled:opacity-50"
              disabled={refreshDisabled}
              onClick={onRefresh}
            >
              Refresh
            </button>
          ) : null}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {visible.length} of {leadsCount}
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
  );
}
