import { useLayoutEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { diagnosticDetail, diagnosticHeading, diagnosticMeta, EMPTY_COPY } from "../copy";
import { notificationCount, reviewAlertTitle, reviewHref, waitingReviews } from "../notifications";
import { useSession } from "../state/session";

export function NotificationsPage() {
  const { data } = useSession();
  const location = useLocation();
  const reviews = waitingReviews(data.pendingProposal);
  const issues = data.sheet.diagnostics;
  const sheetBlocking = data.sheet.status === "error" || data.sheet.status === "unconfigured";
  const empty = notificationCount(data.pendingProposal, issues) === 0 && !sheetBlocking;

  useLayoutEffect(() => {
    if (location.hash !== "#queue") return;
    const node = document.getElementById("queue");
    node?.scrollIntoView({ block: "start" });
  }, [location.hash, issues.length, sheetBlocking]);

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Notifications</h1>

      {empty ? (
        <div className="mt-16">
          <EmptyState icon="review" title={EMPTY_COPY.notifications.title} description={EMPTY_COPY.notifications.description} />
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:gap-14">
          <section className="min-w-0" aria-labelledby="reviews-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="reviews-heading" className="text-sm font-semibold tracking-tight">
                Reviews
              </h2>
              <p className="text-sm tabular-nums text-muted">{reviews.length}</p>
            </div>
            {reviews.length === 0 ? (
              <p className="mt-5 max-w-[32em] text-sm leading-relaxed text-muted">No CRM writes waiting.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {reviews.map((item) => {
                  const failed = item.status === "pending_retry";
                  return (
                    <li key={item.id}>
                      <article
                        className={`rounded-lg bg-surface p-5 shadow-sm ${
                          failed ? "border-t-[3px] border-t-danger" : "border-t-[3px] border-t-accent"
                        }`}
                        aria-label={reviewAlertTitle(item)}
                      >
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                          {item.contactName.trim() || item.leadId}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          {item.lastError
                            ? item.lastError
                            : failed
                              ? "Sheet write failed. Open review to retry."
                              : "CRM write waiting."}
                        </p>
                        <Link
                          to={reviewHref(item.sessionId)}
                          className="mt-4 inline-block text-sm font-semibold text-foreground hover:underline hover:underline-offset-4"
                        >
                          Open review
                        </Link>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="queue" className="min-w-0 scroll-mt-20" aria-labelledby="queue-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="queue-heading" className="text-sm font-semibold tracking-tight">
                Queue
              </h2>
              <p className="text-sm tabular-nums text-muted">{issues.length + (sheetBlocking && issues.length === 0 ? 1 : 0)}</p>
            </div>
            {issues.length === 0 && !sheetBlocking ? (
              <p className="mt-5 max-w-[32em] text-sm leading-relaxed text-muted">No skipped Sheet rows.</p>
            ) : (
              <ul className="mt-5 rounded-lg bg-surface shadow-sm">
                {sheetBlocking && issues.length === 0 ? (
                  <li className="px-5 py-4">
                    <p className="text-[15px] font-semibold tracking-tight text-foreground">Sheet needs a fix</p>
                    <p className="mt-1 max-w-[36em] text-sm leading-relaxed text-muted">
                      {data.sheet.message || EMPTY_COPY.sheet.description}
                    </p>
                  </li>
                ) : null}
                {issues.map((item, index) => {
                  const meta = diagnosticMeta(item);
                  return (
                    <li
                      key={`${item.code}-${item.leadId ?? item.rowNumber ?? index}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3.5"
                    >
                      <p className="min-w-0 text-[15px] font-semibold tracking-tight text-foreground">
                        {diagnosticHeading(item)}
                      </p>
                      <p className="text-sm text-muted">
                        {diagnosticDetail(item)}
                        {meta ? ` · ${meta}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
