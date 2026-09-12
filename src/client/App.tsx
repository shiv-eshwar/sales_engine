import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { BootstrapResponse } from "../shared/contracts";
import { fetchBootstrap } from "./state/api";
import { SessionProvider } from "./state/session";
import { AppLayout } from "./layout/AppLayout";
import { LeadsPage } from "./pages/LeadsPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { ReviewPage } from "./pages/ReviewPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { EmptyState } from "./components/EmptyState";
import { ContactCardSkeleton, BriefLoading, QueueTableSkeleton } from "./components/LoadingSkeleton";
import { EMPTY_COPY, PRODUCT_NAME } from "./copy";
import { SHELL, SPLIT, SPLIT_RAIL } from "./layout/shell";

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBootstrap()
      .then((data) => {
        if (!cancelled) {
          setBootstrap(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-50 bg-background">
          <div className="h-[3px] bg-accent" />
          <div className={`${SHELL} flex h-14 items-center`}>
            <p className="text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
          </div>
        </header>
        <main className={`${SHELL} flex min-h-[calc(100vh-3.75rem)] items-center py-8`}>
          <EmptyState
            icon="error"
            role="alert"
            title={EMPTY_COPY.bootstrap.title}
            description={error || EMPTY_COPY.bootstrap.description}
          />
        </main>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-50 bg-background">
          <div className="h-[3px] bg-accent" />
          <div className={`${SHELL} flex h-14 items-center`}>
            <p className="text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
          </div>
        </header>
        <main className={`${SHELL} py-8`}>
          <BootScreen />
        </main>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <SessionProvider initial={bootstrap}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/leads" replace />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:leadId" element={<LeadDetailPage />} />
            <Route path="/calls/:sessionId/review" element={<ReviewPage />} />
            <Route path="/diagnostics" element={<DiagnosticsPage />} />
            <Route path="/review" element={<Navigate to="/leads" replace />} />
            <Route path="*" element={<Navigate to="/leads" replace />} />
          </Route>
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}

function BootScreen() {
  const path = window.location.pathname;
  if (path.startsWith("/diagnostics")) {
    return (
      <div role="status" aria-label="Loading leads…">
        <div className="h-3.5 w-32 animate-pulse rounded-full bg-surface-secondary" />
        <div className="mt-8 h-7 w-56 animate-pulse rounded-full bg-surface-secondary" />
        <div className="mt-3 h-3.5 w-48 animate-pulse rounded-full bg-surface-secondary" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <div className="h-28 rounded-lg bg-surface shadow-sm" />
          <div className="h-28 rounded-lg bg-surface shadow-sm" />
          <div className="h-28 rounded-lg bg-surface shadow-sm" />
          <div className="h-28 rounded-lg bg-surface shadow-sm" />
          <div className="h-28 rounded-lg bg-surface shadow-sm" />
          <div className="h-28 rounded-lg bg-surface shadow-sm" />
        </div>
      </div>
    );
  }
  if (/^\/leads\/[^/]+/.test(path)) {
    return (
      <div className="flex flex-col gap-8">
        <div className="h-3.5 w-40 animate-pulse rounded-full bg-surface-secondary" />
        <div className={SPLIT}>
          <div className={SPLIT_RAIL}>
            <ContactCardSkeleton />
          </div>
          <section className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <div className="h-3.5 w-12 animate-pulse rounded-full bg-surface-secondary" />
              <div className="h-8 w-32 animate-pulse rounded-lg bg-surface-secondary" />
            </div>
            <div className="mt-6">
              <BriefLoading title="Researching the company…" detail="Preparing the call brief." />
            </div>
          </section>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="h-3.5 w-72 animate-pulse rounded-full bg-surface-secondary" />
        <div className="h-3.5 w-24 animate-pulse rounded-full bg-surface-secondary" />
      </div>
      <div className={SPLIT}>
        <div className={SPLIT_RAIL}>
          <ContactCardSkeleton />
        </div>
        <QueueTableSkeleton />
      </div>
    </div>
  );
}
