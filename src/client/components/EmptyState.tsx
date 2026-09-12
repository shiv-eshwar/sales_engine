import type { ReactNode } from "react";

export type EmptyStateIcon = "campaign" | "leads" | "search" | "review" | "sheet" | "error";

export function EmptyState({
  icon = "leads",
  title,
  description,
  action,
  compact = false,
  role = "status"
}: {
  icon?: EmptyStateIcon;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      aria-label={title}
      className={`mx-auto flex max-w-md flex-col items-center text-center ${compact ? "py-8" : "py-16"}`}
    >
      <div
        aria-hidden="true"
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${
          icon === "error" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"
        }`}
      >
        <EmptyIcon kind={icon} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-[32em] text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

function EmptyIcon({ kind }: { kind: EmptyStateIcon }) {
  const props = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  if (kind === "campaign") {
    return (
      <svg {...props}>
        <path d="M4 5v14" />
        <path d="M4 6h11l-1.5 3L15 12H4" />
        <path d="M9 16.5c.8 1.5 2.2 2.5 4 2.5 2.5 0 4.5-1.8 4.5-4.5V12" />
      </svg>
    );
  }
  if (kind === "search") {
    return (
      <svg {...props}>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }
  if (kind === "review") {
    return (
      <svg {...props}>
        <path d="M8 4h8a2 2 0 0 1 2 2v13l-3-1.5L12 19l-3-1.5L6 19V6a2 2 0 0 1 2-2Z" />
        <path d="M9 9h6M9 13h4" />
      </svg>
    );
  }
  if (kind === "sheet") {
    return (
      <svg {...props}>
        <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-13Z" />
        <path d="M5 9h14M5 14h14M10 4v16" />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 18c.6-2.4 2.5-4 5-4s4.4 1.6 5 4" />
      <circle cx="16.5" cy="8.5" r="2.5" />
      <path d="M15 18c.4-1.6 1.6-2.8 3.2-3.4 1.5.4 2.6 1.6 3 3.1" />
    </svg>
  );
}
