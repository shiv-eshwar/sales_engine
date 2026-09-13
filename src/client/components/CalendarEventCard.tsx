import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import type { CalendarConnectionStatus, PublicCalendarProposal } from "../../shared/contracts";
import {
  approveCalendarProposal,
  dismissCalendarProposal,
  type CalendarProposalPatch
} from "../state/api";

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string, fallback: string): string {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

const field =
  "mt-1 w-full rounded-lg bg-surface-secondary px-3 py-2 text-sm text-foreground outline-none focus:outline-2 focus:outline-offset-2 focus:outline-[var(--focus)]";

export function CalendarEventCard({
  proposal,
  calendar,
  onProposal
}: {
  proposal: PublicCalendarProposal;
  calendar: CalendarConnectionStatus;
  onProposal: (next: PublicCalendarProposal) => void;
}) {
  const pending = proposal.status === "pending" || proposal.status === "failed";
  const [title, setTitle] = useState(proposal.title);
  const [start, setStart] = useState(toLocalInput(proposal.start));
  const [end, setEnd] = useState(toLocalInput(proposal.end));
  const [timezone, setTimezone] = useState(proposal.timezone);
  const [attendees, setAttendees] = useState(proposal.attendees.join(", "));
  const [meet, setMeet] = useState(proposal.meet);
  const [notes, setNotes] = useState(proposal.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(proposal.title);
    setStart(toLocalInput(proposal.start));
    setEnd(toLocalInput(proposal.end));
    setTimezone(proposal.timezone);
    setAttendees(proposal.attendees.join(", "));
    setMeet(proposal.meet);
    setNotes(proposal.notes);
  }, [proposal]);

  function patch(): CalendarProposalPatch {
    return {
      title,
      start: fromLocalInput(start, proposal.start),
      end: fromLocalInput(end, proposal.end),
      timezone,
      attendees: attendees
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      meet,
      notes
    };
  }

  async function onApprove() {
    setBusy(true);
    setError(null);
    try {
      const next = await approveCalendarProposal(proposal.id, patch());
      onProposal(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the invite");
    } finally {
      setBusy(false);
    }
  }

  async function onDismiss() {
    setBusy(true);
    setError(null);
    try {
      const next = await dismissCalendarProposal(proposal.id);
      onProposal(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not dismiss");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border-t-[3px] border-t-accent bg-surface p-4 shadow-sm" aria-label="Calendar event">
      <p className="text-sm font-semibold">Calendar invite</p>
      <p className="mt-1 text-xs text-muted">Nothing is sent until you Approve.</p>

      {proposal.status === "sent" ? (
        <p className="mt-3 text-sm">
          Sent.
          {proposal.htmlLink ? (
            <>
              {" "}
              <a className="font-medium text-accent underline-offset-4 hover:underline" href={proposal.htmlLink} target="_blank" rel="noreferrer">
                Open in Calendar
              </a>
            </>
          ) : null}
        </p>
      ) : proposal.status === "dismissed" ? (
        <p className="mt-3 text-sm text-muted">Dismissed. Not sent.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          <label className="text-xs font-medium text-muted">
            Title
            <input className={field} value={title} onChange={(event) => setTitle(event.target.value)} disabled={!pending} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted">
              Start
              <input className={field} type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} disabled={!pending} />
            </label>
            <label className="text-xs font-medium text-muted">
              End
              <input className={field} type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} disabled={!pending} />
            </label>
          </div>
          <label className="text-xs font-medium text-muted">
            Timezone
            <input className={field} value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={!pending} />
          </label>
          <label className="text-xs font-medium text-muted">
            Attendees (emails)
            <input
              className={field}
              value={attendees}
              onChange={(event) => setAttendees(event.target.value)}
              placeholder="Add emails — the Sheet has no email column"
              disabled={!pending}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={meet} onChange={(event) => setMeet(event.target.checked)} disabled={!pending} />
            Google Meet
          </label>
          <label className="text-xs font-medium text-muted">
            Notes
            <textarea className={`${field} min-h-16`} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!pending} />
          </label>
        </div>
      )}

      {proposal.status === "failed" ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          Send failed{proposal.lastError ? `: ${proposal.lastError}` : "."} Approve again to retry.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!calendar.connected ? (
            calendar.configured ? (
              <a className="text-sm font-medium text-accent underline-offset-4 hover:underline" href="/api/google/calendar/connect">
                Connect Calendar
              </a>
            ) : (
              <p className="text-sm text-muted">Calendar OAuth is not configured.</p>
            )
          ) : (
            <Button className="min-h-11 rounded-lg!" isDisabled={busy} onPress={() => void onApprove()}>
              Approve
            </Button>
          )}
          <button
            type="button"
            className="text-sm text-muted hover:text-foreground hover:underline hover:underline-offset-4 disabled:opacity-50"
            disabled={busy}
            onClick={() => void onDismiss()}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </article>
  );
}
