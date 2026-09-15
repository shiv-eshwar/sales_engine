import { SPLIT, SPLIT_PANE, SPLIT_RAIL } from "../layout/shell";
import { AuthWash } from "./AuthShell";
import { ThemeToggle } from "./ThemeToggle";
import { REVIEW_COLUMN, REVIEW_COMPOSER } from "./reviewChatLayout";

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

function Pulse({ className, ground = false }: { className: string; ground?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-full ${ground ? "bg-border" : "bg-surface-secondary"} ${className}`}
    />
  );
}

export function ContactCardSkeleton({
  skip = false,
  label
}: {
  skip?: boolean;
  label?: string;
}) {
  return (
    <div
      className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-lg border-t-[3px] border-t-accent bg-surface shadow-sm max-lg:pb-[5.5rem]"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div className="relative z-20 flex shrink-0 flex-col gap-1 bg-surface px-5 pt-5 sm:px-8 sm:pt-8">
        <Pulse className="h-7 w-48 sm:h-8" />
        <Pulse className="h-3.5 w-40" />
        <Pulse className="mt-1 h-3.5 w-36" />
      </div>
      <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="h-full min-h-0 overflow-hidden px-5 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-8">
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-5 sm:gap-8">
            <div className="flex shrink-0 flex-col gap-2">
              <Pulse className="h-3.5 w-full" />
              <Pulse className="h-3.5 w-4/5" />
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-accent-soft px-5 py-5 sm:px-6 sm:py-6">
              <Pulse className="h-4 w-6 shrink-0 rounded-sm bg-accent/15" />
              <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-hidden">
                <Pulse className="h-3 w-full bg-accent/15" />
                <Pulse className="h-3 w-5/6 bg-accent/15" />
                <Pulse className="h-3 w-2/3 bg-accent/15" />
                <Pulse className="h-3 w-11/12 bg-accent/15" />
                <Pulse className="h-3 w-3/4 bg-accent/15" />
              </div>
            </div>
            <div className="shrink-0 space-y-2">
              <Pulse className="h-3.5 w-full" />
              <Pulse className="h-3.5 w-4/5" />
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-20 isolate mt-auto flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 bg-surface px-5 py-4 shadow-[0_-8px_24px_-12px_var(--elev-shadow)] sm:gap-x-5 sm:px-8 sm:pb-8 sm:pt-4 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:px-[max(1.25rem,env(safe-area-inset-left))] max-lg:pr-[max(1.25rem,env(safe-area-inset-right))] max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:pt-4">
        <Pulse className="h-11 w-28 rounded-lg" />
        {skip ? <Pulse className="h-11 w-20 rounded-lg" /> : null}
        <Pulse className="h-3.5 w-14" />
      </div>
    </div>
  );
}

export function BriefLoading({ error }: { error?: string | null } = {}) {
  return (
    <section
      className="brief-card-pulse flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-surface shadow-sm"
      role="status"
      aria-label="AI prospect brief"
      aria-busy="true"
      data-brief-state="loading"
    >
      {error ? (
        <p role="alert" className="shrink-0 px-5 pt-5 text-sm font-medium text-danger sm:px-8 sm:pt-8">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function BriefCardSkeleton() {
  return (
    <section
      className="brief-card-pulse flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-surface shadow-sm"
      aria-hidden="true"
      data-brief-state="loading"
    />
  );
}

export function QueueTableSkeleton() {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5" aria-hidden="true">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-1">
        <Pulse className="h-9 min-w-52 flex-1 rounded-lg bg-surface shadow-sm" />
        <Pulse ground className="h-3.5 w-12" />
        <div className="flex items-center gap-3">
          <Pulse ground className="h-3.5 w-10" />
          <Pulse ground className="h-3.5 w-16" />
          <Pulse ground className="h-3.5 w-12" />
        </div>
      </div>
      <ul className="space-y-3 lg:hidden">
        {[1, 2, 3].map((row) => (
          <li key={row} className="rounded-lg bg-surface px-4 py-3 shadow-sm">
            <Pulse className="h-4 w-36" />
            <Pulse className="mt-1.5 h-3.5 w-44" />
            <Pulse className="mt-2 h-3 w-28" />
          </li>
        ))}
      </ul>
      <div className="hidden min-h-0 flex-1 rounded-lg bg-surface shadow-sm lg:block">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4 px-4 py-3">
          <Pulse className="h-3 w-10" />
          <Pulse className="h-3 w-16" />
          <Pulse className="h-3 w-12" />
          <Pulse className="h-3 w-12" />
        </div>
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-4 px-4 py-2.5">
            <div>
              <Pulse className="h-3.5 w-28" />
              <Pulse className="mt-1 h-3 w-20" />
            </div>
            <Pulse className="h-3.5 w-24" />
            <Pulse className="h-3 w-28" />
            <Pulse className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomeBootSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5 lg:overflow-hidden" role="status" aria-label="Loading leads…">
      <div className={SPLIT}>
        <div className={SPLIT_RAIL}>
          <ContactCardSkeleton skip />
        </div>
        <div className={SPLIT_PANE}>
          <QueueTableSkeleton />
        </div>
      </div>
    </div>
  );
}

export function LeadDetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5 lg:overflow-hidden" role="status" aria-label="Loading lead…">
      <div className={SPLIT}>
        <div className={SPLIT_RAIL}>
          <ContactCardSkeleton />
        </div>
        <div className={SPLIT_PANE}>
          <BriefCardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsStatsSkeleton({ labeled = true }: { labeled?: boolean }) {
  return (
    <section
      className="rounded-lg bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-10 lg:py-10"
      role={labeled ? "status" : undefined}
      aria-label={labeled ? "Loading analytics…" : undefined}
      aria-hidden={labeled ? undefined : true}
    >
      <div className="grid grid-cols-3 gap-6 lg:gap-10" aria-hidden="true">
        {[1, 2, 3].map((index) => (
          <div key={index} className="min-w-0">
            <Pulse className="h-3.5 w-16" />
            <Pulse className="mt-2 h-9 w-14 sm:h-10" />
          </div>
        ))}
      </div>
      <div className="mt-10 space-y-8" aria-hidden="true">
        {[3, 4, 3].map((count, group) => (
          <div key={group} className="min-w-0">
            <Pulse className="h-3.5 w-24" />
            <div className={`mt-4 grid gap-6 ${count === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
              {Array.from({ length: count }, (_, index) => (
                <div key={index} className="min-w-0">
                  <Pulse className="h-3.5 w-14" />
                  <Pulse className="mt-1 h-6 w-8" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics…">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <Pulse ground className="h-6 w-28" />
          <Pulse ground className="mt-1 h-4 w-16" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3" aria-hidden="true">
          <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1">
            <Pulse className="h-9 w-14 rounded-md bg-surface" />
            <Pulse className="h-9 w-20 rounded-md" />
            <Pulse className="h-9 w-[10.5rem] rounded-md" />
          </div>
          <Pulse className="h-11 w-full rounded-lg bg-surface shadow-sm sm:w-72" />
        </div>
      </div>
      <div className="mt-8">
        <AnalyticsStatsSkeleton labeled={false} />
      </div>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div role="status" aria-label="Loading notifications…">
      <Pulse ground className="h-6 w-36" />
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:gap-14" aria-hidden="true">
        <section className="min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <Pulse ground className="h-4 w-16" />
            <Pulse ground className="h-4 w-4" />
          </div>
          <div className="mt-5 rounded-lg border-t-[3px] border-t-accent bg-surface p-5 shadow-sm">
            <Pulse className="h-5 w-48" />
            <Pulse className="mt-1 h-3.5 w-56 max-w-full" />
            <Pulse className="mt-4 h-3.5 w-24" />
          </div>
        </section>
        <section className="min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <Pulse ground className="h-4 w-14" />
            <Pulse ground className="h-4 w-4" />
          </div>
          <ul className="mt-5 rounded-lg bg-surface shadow-sm">
            {[1, 2, 3, 4].map((row) => (
              <li key={row} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3.5">
                <Pulse className="h-4 w-36" />
                <Pulse className="h-3.5 w-32" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl" role="status" aria-label="Loading settings…">
      <Pulse ground className="h-6 w-24" />
      <div className="mt-10 flex flex-col gap-12" aria-hidden="true">
        {[1, 2, 3].map((section) => (
          <div key={section}>
            <Pulse ground className="h-4 w-20" />
            <div className="mt-3 rounded-lg border-t-[3px] border-t-accent bg-surface p-5 shadow-sm">
              <Pulse className="h-5 w-48" />
              <Pulse className="mt-1 h-3.5 w-64 max-w-full" />
              <Pulse className="mt-4 h-11 w-36 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <section className="review-chat flex min-h-0 flex-1 flex-col" role="status" aria-label="Loading review…">
      <div className="flex min-h-0 flex-1 flex-col" aria-hidden="true">
        <div className={`${REVIEW_COLUMN} flex min-h-0 flex-1 flex-col gap-6 py-5`}>
          <Pulse ground className="h-3.5 w-72 max-w-full" />
          <div className="w-full max-w-[42rem]">
            <Pulse className="h-3 w-full" />
            <Pulse className="mt-2.5 h-3 w-5/6" />
            <Pulse className="mt-2.5 h-3 w-4/5" />
            <Pulse className="mt-2.5 h-3 w-2/3" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pulse className="h-9 w-40 rounded-lg bg-accent/20" />
            <Pulse className="h-9 w-24 rounded-lg" />
            <Pulse className="h-9 w-32 rounded-lg" />
          </div>
        </div>
        <div className="relative shrink-0">
          <div className={`${REVIEW_COLUMN} pb-1 pt-1`}>
            <div className={REVIEW_COMPOSER}>
              <Pulse className="min-h-11 flex-1 rounded-lg" />
              <Pulse className="h-10 w-16 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LoginSkeleton({ fields = 2 }: { fields?: 2 | 3 }) {
  const label = fields === 3 ? "Loading create account…" : "Loading sign in…";
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="relative z-20 h-[3px] bg-accent" />
      <AuthWash />
      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-5 z-30">
        <ThemeToggle />
      </div>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12" role="status" aria-label={label}>
        <div className="flex items-center gap-2">
          <Pulse ground className="size-6 rounded-lg" />
          <Pulse ground className="h-4 w-16" />
        </div>
        <Pulse ground className="mt-8 h-8 w-36" />
        <Pulse ground className="mt-2 h-5 w-64 max-w-full" />
        <div className="mt-8 flex flex-col gap-5" aria-hidden="true">
          {Array.from({ length: fields }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Pulse className="h-3.5 w-20" />
              <Pulse className="h-11 w-full rounded-lg" />
            </div>
          ))}
          <Pulse className="h-11 w-full rounded-lg" />
        </div>
      </main>
    </div>
  );
}

export function bootSkeleton(pathname: string) {
  if (pathname.startsWith("/login")) return <LoginSkeleton fields={2} />;
  if (pathname.startsWith("/signup")) return <LoginSkeleton fields={3} />;
  if (pathname.startsWith("/analytics")) return <AnalyticsSkeleton />;
  if (pathname.startsWith("/settings")) return <SettingsSkeleton />;
  if (pathname.startsWith("/notifications") || pathname.startsWith("/diagnostics")) {
    return <NotificationsSkeleton />;
  }
  if (/^\/calls\/[^/]+\/review/.test(pathname)) return <ReviewSkeleton />;
  if (/^\/leads\/[^/]+/.test(pathname)) return <LeadDetailSkeleton />;
  return <HomeBootSkeleton />;
}
