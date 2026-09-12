import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { PublicLead } from "../../shared/contracts";
import { Icon } from "./Icon";

export type LeadSortKey = "name" | "company" | "status";

export function sortLeads(leads: PublicLead[], key: LeadSortKey, dir: 1 | -1): PublicLead[] {
  const pick = (lead: PublicLead): string => {
    if (key === "company") return `${lead.company} ${lead.fullName}`.toLowerCase();
    if (key === "status") return `${lead.callStatus} ${lead.crmStatus} ${lead.fullName}`.toLowerCase();
    return `${lead.fullName} ${lead.company}`.toLowerCase();
  };
  return [...leads].sort((a, b) => {
    const left = pick(a);
    const right = pick(b);
    if (left < right) return -1 * dir;
    if (left > right) return 1 * dir;
    return 0;
  });
}

export function filterLeads(
  leads: PublicLead[],
  query: string,
  dialableOnly: boolean
): PublicLead[] {
  const needle = query.trim().toLowerCase();
  return leads.filter((lead) => {
    if (dialableOnly && !lead.dialable) return false;
    if (!needle) return true;
    return [lead.fullName, lead.company, lead.role, lead.phone, lead.phoneE164 ?? "", lead.leadId]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

export function LeadsTable({
  leads,
  empty
}: {
  leads: PublicLead[];
  empty?: ReactNode;
}) {
  if (leads.length === 0) {
    return <div className="mt-4">{empty}</div>;
  }

  return (
    <>
      <ul className="mt-4 space-y-3 md:hidden" aria-label="Leads">
        {leads.map((lead) => (
          <li key={lead.leadId}>
            <Link
              to={`/leads/${encodeURIComponent(lead.leadId)}`}
              className="block rounded-lg bg-surface px-4 py-3 shadow-sm"
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
      </ul>
      <div className="mt-4 hidden overflow-hidden rounded-lg bg-surface shadow-sm md:block">
        <table className="w-full text-left text-sm" aria-label="Leads">
          <thead>
            <tr className="border-b border-separator">
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Name</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Company</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Phone</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              return (
                <tr key={lead.leadId} className="border-b border-separator last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/leads/${encodeURIComponent(lead.leadId)}`}
                      className="font-semibold text-foreground hover:underline hover:underline-offset-2"
                      aria-label={`Open ${lead.fullName || lead.leadId}`}
                    >
                      {lead.fullName || "Unnamed contact"}
                    </Link>
                    {lead.role ? <p className="mt-0.5 text-sm text-muted">{lead.role}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.company || "—"}</td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-sm text-muted">
                    {[lead.callStatus, lead.crmStatus].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
