import { Link } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState } from "../components/EmptyState";
import { EMPTY_COPY } from "../copy";
import { useSession } from "../state/session";
import type { PublicProposal } from "../../shared/contracts";

function reviewHref(sessionId: string): string {
  return `/calls/${encodeURIComponent(sessionId)}/review`;
}

function alertTitle(item: PublicProposal): string {
  const who = item.contactName.trim() || item.leadId;
  if (item.status === "pending_retry") {
    return `CRM write failed for ${who}`;
  }
  return `Review waiting for ${who}`;
}

function operatorAlerts(pending: PublicProposal | null): PublicProposal[] {
  if (!pending || pending.status === "processing") return [];
  return [pending];
}

export function NotificationsPage() {
  const { data } = useSession();
  const items = operatorAlerts(data.pendingProposal);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Home", to: "/leads" }, { label: "Notifications" }]} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:mt-8">Notifications</h1>
      <p className="mt-3 max-w-[32em] text-sm leading-relaxed text-muted">
        Operator follow-ups that need a review before the Sheet is updated.
      </p>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState icon="review" title={EMPTY_COPY.notifications.title} description={EMPTY_COPY.notifications.description} />
        </div>
      ) : (
        <ul className="mt-10 max-w-xl space-y-8">
          {items.map((item) => (
            <li key={item.id}>
              <p className="text-base font-semibold tracking-tight text-foreground">{alertTitle(item)}</p>
              {item.lastError ? <p className="mt-1 text-sm leading-relaxed text-muted">{item.lastError}</p> : null}
              <Link
                to={reviewHref(item.sessionId)}
                className="mt-2 inline-block text-sm font-semibold text-foreground hover:underline hover:underline-offset-4"
              >
                Open review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
