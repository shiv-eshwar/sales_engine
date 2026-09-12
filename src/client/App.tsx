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
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { EmptyState } from "./components/EmptyState";
import { EMPTY_COPY } from "./copy";

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
      <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-8">
        <EmptyState
          icon="error"
          role="alert"
          title={EMPTY_COPY.bootstrap.title}
          description={error || EMPTY_COPY.bootstrap.description}
        />
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <LoadingSkeleton title="Loading leads…" detail="Connecting to your queue and campaigns." lines={4} />
      </main>
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

// Keep setBootstrap available for future session refresh flows.
