import type { ReactNode } from "react";

export function PageSpinner({
  label,
  compact = false
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center ${compact ? "min-h-[12rem] gap-4" : "min-h-[calc(100vh-8rem)] gap-5"}`}
      role="status"
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className={`${compact ? "h-6 w-6" : "h-7 w-7"} animate-spin rounded-full border-2 border-border border-t-accent`}
      />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-surface-secondary ${className}`} />;
}

export function ContactCardSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border-t-[3px] border-t-accent bg-surface shadow-sm max-lg:pb-[5.5rem]"
      role="status"
      aria-label="Loading leads…"
    >
      <div className="relative z-20 flex shrink-0 flex-col gap-1 bg-surface px-5 pt-5 sm:px-8 sm:pt-8">
        <Pulse className="h-7 w-48" />
        <Pulse className="mt-2 h-3.5 w-36" />
        <Pulse className="mt-1 h-3.5 w-52" />
        <Pulse className="mt-2 h-3.5 w-40" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-5 pt-5 sm:gap-8 sm:px-8 sm:pt-8">
        <div className="flex flex-col gap-2">
          <Pulse className="h-3.5 w-full" />
          <Pulse className="h-3.5 w-4/5" />
        </div>
        <div className="min-h-[4.75rem] overflow-hidden rounded-lg bg-accent-soft px-5 py-5 sm:min-h-[8rem] sm:px-6 sm:py-6">
          <Pulse className="h-4 w-6 rounded-sm bg-accent/15" />
          <Pulse className="mt-3 h-3 w-full bg-accent/15" />
          <Pulse className="mt-3 h-3 w-5/6 bg-accent/15" />
          <Pulse className="mt-3 h-3 w-2/3 bg-accent/15" />
        </div>
        <div className="min-h-[2.5rem] space-y-2 sm:min-h-[3rem]">
          <Pulse className="h-3.5 w-full" />
          <Pulse className="h-3.5 w-3/4" />
        </div>
      </div>
      <div className="mt-auto flex shrink-0 gap-4 bg-surface px-5 py-4 shadow-[0_-8px_24px_-12px_hsl(220_20%_12%/0.12)] sm:px-8 sm:pb-8 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:px-[max(1.25rem,env(safe-area-inset-left))] max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:pt-4">
        <Pulse className="h-11 w-28 rounded-lg" />
        <Pulse className="h-11 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function BriefLoading({
  title,
  detail,
  action,
  error
}: {
  title: string;
  detail: string;
  action?: ReactNode;
  error?: string | null;
}) {
  return (
    <div className="rounded-lg bg-surface p-5 shadow-sm sm:p-8" role="status" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent"
          />
          <p className="text-sm font-medium">{title}</p>
        </div>
        {action}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
      <p className="mt-3 max-w-[32em] text-sm leading-relaxed text-muted">{detail}</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2" aria-hidden="true">
        <div className="space-y-3">
          <Pulse className="h-3 w-24" />
          <Pulse className="h-3 w-full" />
          <Pulse className="h-3 w-5/6" />
          <Pulse className="h-3 w-2/3" />
        </div>
        <div className="space-y-3">
          <Pulse className="h-3 w-24" />
          <Pulse className="h-3 w-full" />
          <Pulse className="h-3 w-4/5" />
          <Pulse className="h-3 w-3/5" />
        </div>
      </div>
      <div className="mt-8 space-y-3" aria-hidden="true">
        <Pulse className="h-3 w-40" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-5/6" />
      </div>
      <div className="mt-8 min-h-[7.5rem] rounded-lg bg-accent-soft px-5 py-5" aria-hidden="true">
        <Pulse className="h-3 w-full bg-accent/15" />
        <Pulse className="mt-3 h-3 w-5/6 bg-accent/15" />
        <Pulse className="mt-3 h-3 w-2/3 bg-accent/15" />
      </div>
      <div className="mt-8 space-y-4" aria-hidden="true">
        <Pulse className="h-3 w-28" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-11/12" />
        <Pulse className="h-3 w-4/5" />
        <Pulse className="h-3 w-5/6" />
      </div>
      <div className="mt-8 space-y-3" aria-hidden="true">
        <Pulse className="h-3 w-36" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function QueueTableSkeleton() {
  return (
    <section aria-hidden="true">
      <div className="flex flex-wrap items-center gap-3">
        <Pulse className="h-10 min-w-52 flex-1 rounded-lg" />
        <Pulse className="h-4 w-28" />
        <Pulse className="ml-auto h-8 w-16 rounded-lg" />
        <Pulse className="h-8 w-20 rounded-lg" />
        <Pulse className="h-8 w-16 rounded-lg" />
      </div>
      <Pulse className="mt-3 h-3.5 w-56" />
      <div className="mt-4 overflow-hidden rounded-lg bg-surface shadow-sm">
        <div className="border-b border-separator px-4 py-3">
          <Pulse className="h-3 w-40" />
        </div>
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center gap-6 border-b border-separator px-4 py-3 last:border-b-0">
            <Pulse className="h-3.5 w-36" />
            <Pulse className="h-3.5 w-28" />
            <Pulse className="h-3.5 w-24" />
            <Pulse className="ml-auto h-3.5 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReviewSkeleton() {
  return (
    <div role="status" aria-label="Loading review…">
      <Pulse className="h-7 w-56" />
      <Pulse className="mt-3 h-3.5 w-72" />
      <Pulse className="mt-10 h-6 w-36" />
      <div className="mt-8 max-w-4xl overflow-hidden rounded-lg bg-surface shadow-sm">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-8 border-b border-separator px-5 py-3.5 last:border-0">
            <Pulse className="h-3.5 w-28" />
            <Pulse className="h-3.5 w-16" />
            <Pulse className="ml-auto h-3.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
