import { Link } from "react-router-dom";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import type { PublicLead } from "../../shared/contracts";
import { filterLeads, sortLeads, type LeadSortKey } from "../../shared/leadsQueue";
import { Icon } from "./Icon";
import { SCROLL, SCROLL_X } from "../layout/shell";

export type { LeadSortKey };
export { filterLeads, sortLeads };

function LoadSentinel({
  disabled,
  onVisible,
  rootRef
}: {
  disabled: boolean;
  onVisible: () => void;
  rootRef?: RefObject<Element | null>;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    if (disabled) return;
    const node = nodeRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisibleRef.current();
      },
      { root: rootRef?.current ?? null, rootMargin: "96px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled, rootRef]);

  return <div ref={nodeRef} aria-hidden className="h-px w-full" />;
}

export function LeadsTable({
  leads,
  empty,
  hasMore = false,
  loadingMore = false,
  onLoadMore
}: {
  leads: PublicLead[];
  empty?: ReactNode;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const tableScrollRef = useRef<HTMLDivElement>(null);

  if (leads.length === 0) {
    return <div>{empty}</div>;
  }

  const sentinel = onLoadMore ? (
    <LoadSentinel disabled={!hasMore || loadingMore} onVisible={onLoadMore} rootRef={tableScrollRef} />
  ) : null;

  return (
    <>
      <ul className="space-y-3 lg:hidden" aria-label="Leads">
        {leads.map((lead) => (
          <li key={lead.leadId}>
            <Link
              to={`/leads/${encodeURIComponent(lead.leadId)}`}
              className="block min-h-11 rounded-lg bg-surface px-4 py-3 shadow-sm"
              aria-label={`Open ${lead.fullName || lead.leadId}`}
            >
              <p className="font-semibold">{lead.fullName || "Unnamed contact"}</p>
              <p className="mt-0.5 text-sm text-muted">
                {[lead.role, lead.company].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="mt-1 flex items-center gap-2 font-mono text-xs tabular-nums">
                <Icon
                  name={lead.dialable ? "phone" : "phoneOff"}
                  size={14}
                  className={lead.dialable ? "text-muted" : "text-danger"}
                  title={lead.dialable ? undefined : "Not dialable"}
                />
                {lead.phoneE164 ?? lead.phone}
              </p>
            </Link>
          </li>
        ))}
        {onLoadMore ? (
          <li>
            <LoadSentinel disabled={!hasMore || loadingMore} onVisible={onLoadMore} />
            {loadingMore ? <p className="py-2 text-center text-sm text-muted">Loading…</p> : null}
          </li>
        ) : null}
      </ul>
      <div
        ref={tableScrollRef}
        className={`hidden min-h-0 flex-1 ${SCROLL} ${SCROLL_X} rounded-lg bg-surface shadow-sm lg:block`}
      >
        <table className="w-full text-left text-sm" aria-label="Leads">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Name</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Company</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Phone</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              return (
                <tr key={lead.leadId} className="hover:bg-surface-secondary">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/leads/${encodeURIComponent(lead.leadId)}`}
                      className="font-semibold text-foreground hover:underline hover:underline-offset-2"
                      aria-label={`Open ${lead.fullName || lead.leadId}`}
                    >
                      {lead.fullName || "Unnamed contact"}
                    </Link>
                    {lead.role ? <p className="mt-0.5 text-sm text-muted">{lead.role}</p> : null}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{lead.company || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-mono text-xs tabular-nums">
                      <Icon
                        name={lead.dialable ? "phone" : "phoneOff"}
                        size={14}
                        className={lead.dialable ? "text-muted" : "text-danger"}
                        title={lead.dialable ? undefined : "Not dialable"}
                      />
                      {lead.phoneE164 ?? lead.phone}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted">
                    {[lead.callStatus, lead.crmStatus].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sentinel}
        {loadingMore ? <p className="px-4 py-2 text-sm text-muted">Loading…</p> : null}
      </div>
    </>
  );
}
