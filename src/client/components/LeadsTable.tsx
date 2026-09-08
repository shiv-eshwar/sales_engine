import { Link } from "react-router-dom";
import type { PublicLead } from "../../shared/contracts";

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

export function LeadsTable({ leads }: { leads: PublicLead[] }) {
  if (leads.length === 0) {
    return <p className="mt-3 text-sm text-slate-600">No leads match this filter.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm" aria-label="Leads">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Company</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Phone</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => {
            return (
              <tr key={lead.leadId} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link
                    to={`/leads/${encodeURIComponent(lead.leadId)}`}
                    className="font-medium text-indigo-800 underline-offset-2 hover:underline"
                    aria-label={`Open ${lead.fullName || lead.leadId}`}
                  >
                    {lead.fullName || "Unnamed contact"}
                  </Link>
                  {!lead.dialable ? (
                    <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      Not dialable
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-slate-700">{lead.company || "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{lead.role || "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{lead.phoneE164 ?? lead.phone}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {[lead.callStatus, lead.crmStatus].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    to={`/leads/${encodeURIComponent(lead.leadId)}`}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                    aria-label={`Open ${lead.fullName || lead.leadId}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
