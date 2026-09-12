import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@heroui/react";
import { useSession } from "../state/session";
import { DailySummaryPanel } from "../components/DailySummaryPanel";
import { LeadsTable, filterLeads, sortLeads, type LeadSortKey } from "../components/LeadsTable";
import { ReadyContactCard } from "../components/ReadyContactCard";
import { AssignLeads } from "../components/AssignLeads";
import { CallingPanel } from "../components/CallingPanel";
import { AI_DISCONNECTED_COPY } from "../copy";
import { useLeadCall } from "../state/useLeadCall";

export function LeadsPage() {
  const { data, pending, campaignBusy, setEditor, refresh } = useSession();
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
  const hasFilter = query.trim().length > 0 || dialableOnly;

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
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {nextLead ? (
            <p className="text-muted text-sm font-medium uppercase tracking-wide">Ready</p>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">Ready</h1>
          )}
          <p className="text-muted text-sm">
            {campaign ? (
              <>Selling <strong className="text-foreground">{campaign.brief?.offeringName ?? campaign.name}</strong> · {data.leads.length} eligible</>
            ) : (
              "Create a campaign to start calling — AI generation is optional."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign?.brief ? (
            <Button
              variant="outline"
              size="sm"
              isDisabled={pending || campaignBusy}
              onPress={() => setEditor("edit")}
            >
              Edit offering
            </Button>
          ) : null}
          {campaign ? (
            <AssignLeads
              campaignId={campaign.id}
              disabled={pending || campaignBusy}
              onAssigned={async () => {
                await refresh();
              }}
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            isDisabled={pending || campaignBusy}
            onPress={onRefresh}
          >
            Refresh
          </Button>
        </div>
      </header>

      {data.ai.status !== "ok" ? (
        <Alert status="warning" className="mt-3" role="status">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{data.ai.message.includes("LLM_") ? AI_DISCONNECTED_COPY : data.ai.message}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {data.research.status !== "ok" && data.ai.status === "ok" ? (
        <Alert status="warning" className="mt-3">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{data.research.message}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {data.pendingProposal ? (
        <Alert status="accent" className="mt-3">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              Review waiting for {data.pendingProposal.contactName || data.pendingProposal.leadId}.{" "}
              <Link
                to={`/calls/${encodeURIComponent(data.pendingProposal.sessionId)}/review`}
                className="font-medium underline underline-offset-2"
              >
                Open review
              </Link>
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {!campaign ? (
        <Card className="mt-6 max-w-xl" aria-label="Create a campaign">
          <Card.Header>
            <h2 className="text-lg font-semibold tracking-tight">Create a campaign</h2>
            <Card.Description>
              Describe the offering in chat. The assistant interviews you and produces the campaign. You do not need AI
              connected to call an existing campaign.
            </Card.Description>
          </Card.Header>
          <Card.Footer>
            <Button onPress={() => setEditor("new")}>Create a campaign</Button>
          </Card.Footer>
        </Card>
      ) : nextLead ? (
        <div className="mt-5">
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
        </div>
      ) : (
        <Card className="mt-6 max-w-xl">
          <Card.Header>
            <Card.Title>No one is ready to call</Card.Title>
            <Card.Description>
              Assign eligible Sheet contacts to this campaign, or fix phone numbers that cannot be dialed.
            </Card.Description>
          </Card.Header>
        </Card>
      )}

      {campaign ? (
        <Card className="mt-8" aria-label="All leads">
          <Card.Header>
            <p className="text-muted text-sm font-medium uppercase tracking-wide">All leads</p>
          </Card.Header>
          <Card.Content>
            <div className="flex flex-wrap items-center gap-3">
              <label className="min-w-52 flex-1 text-sm">
                <span className="sr-only">Search leads</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, company, phone…"
                  aria-label="Search leads"
                  className="border-separator w-full rounded-md border px-3 py-2 text-sm"
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
                <Button variant="ghost" size="sm" onPress={() => setDialableOnly(false)}>
                  {undialableCount} need a phone fix
                </Button>
              ) : null}
              <div className="flex items-center gap-1 text-sm" role="group" aria-label="Sort leads">
                {([["name", "Name"], ["company", "Company"], ["status", "Status"]] as Array<[LeadSortKey, string]>).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={sortKey === key ? "primary" : "outline"}
                    aria-pressed={sortKey === key}
                    onPress={() => toggleSort(key)}
                  >
                    {label}{sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-muted mt-2 text-xs" aria-live="polite">
              Showing {visible.length} of {data.leads.length} eligible leads.
            </p>
            <LeadsTable
              leads={visible}
              emptyReason={
                visible.length === 0
                  ? query.trim()
                    ? "No leads match this search."
                    : dialableOnly
                      ? "No dialable leads. Contacts that need a phone fix are hidden."
                      : "No eligible leads assigned to this campaign."
                  : null
              }
              hasActiveFilter={hasFilter}
            />
          </Card.Content>
        </Card>
      ) : null}

      <DailySummaryPanel summary={data.summary} />
    </div>
  );
}
