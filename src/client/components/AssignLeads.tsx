import { useEffect, useState } from "react";
import { Alert, Button, Card } from "@heroui/react";
import type { CampaignLead } from "../../shared/campaigns";
import { assignCampaignLeads, fetchCampaignLeads } from "../state/api";
import { EmptyState } from "./EmptyState";
import { EMPTY_COPY } from "../copy";

export function AssignLeads({
  campaignId,
  disabled,
  onAssigned
}: {
  campaignId: string;
  disabled?: boolean;
  onAssigned: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<CampaignLead[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setError(null);
    setLeads(null);
    void fetchCampaignLeads(campaignId, controller.signal)
      .then((result) => {
        setLeads(result.leads);
        setSelected(new Set(result.leads.filter((lead) => lead.assigned).map((lead) => lead.leadId)));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Could not load assignable leads");
        }
      });
    return () => controller.abort();
  }, [open, campaignId]);

  async function save() {
    if (!leads) return;
    setPending(true);
    setError(null);
    try {
      const assigned = leads.filter((lead) => selected.has(lead.leadId)).map((lead) => lead.leadId);
      const removed = leads.filter((lead) => lead.assigned && !selected.has(lead.leadId)).map((lead) => lead.leadId);
      if (assigned.length) await assignCampaignLeads(campaignId, assigned, true);
      if (removed.length) await assignCampaignLeads(campaignId, removed, false);
      await onAssigned();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign leads");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        isDisabled={disabled || pending}
        onPress={() => setOpen((value) => !value)}
      >
        {open ? "Hide assign leads" : "Assign leads"}
      </Button>
      {open ? (
        <Card className="mt-3" aria-label="Assign leads">
          <Card.Header>
            <Card.Description>
              Choose eligible Sheet contacts for this campaign. Assignment stays in this app and does not change the
              Sheet’s Campaign column.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {error ? (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{error}</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}
            {leads === null && !error ? <p className="text-muted mt-3 text-sm">Loading contacts…</p> : null}
            {leads && leads.length === 0 ? (
              <EmptyState
                compact
                icon="leads"
                title={EMPTY_COPY.assign.title}
                description={EMPTY_COPY.assign.description}
              />
            ) : null}
            {leads && leads.length > 0 ? (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
                {leads.map((lead) => (
                  <li key={lead.leadId}>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.leadId)}
                        disabled={pending}
                        onChange={() => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(lead.leadId)) next.delete(lead.leadId);
                            else next.add(lead.leadId);
                            return next;
                          });
                        }}
                      />
                      <span>
                        <span className="font-medium">{lead.fullName || lead.leadId}</span>
                        {lead.company ? <span className="text-muted"> · {lead.company}</span> : null}
                        {lead.role ? <span className="text-muted"> · {lead.role}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card.Content>
          <Card.Footer className="flex gap-2">
            <Button isDisabled={pending || !leads} isPending={pending} onPress={() => void save()}>
              {pending ? "Saving…" : "Save assignments"}
            </Button>
            <Button variant="ghost" isDisabled={pending} onPress={() => setOpen(false)}>
              Done
            </Button>
          </Card.Footer>
        </Card>
      ) : null}
    </div>
  );
}
