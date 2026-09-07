import { useEffect, useState } from "react";
import type { BootstrapResponse } from "../shared/contracts";
import { ReadyPage } from "./pages/ReadyPage";
import { fetchBootstrap } from "./state/api";

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
      <main className="p-8">
        <p role="alert" className="text-red-700">
          {error}
        </p>
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <p className="p-8 text-sm text-slate-600" role="status">
        Loading next lead…
      </p>
    );
  }

  return <ReadyPage data={bootstrap} onChange={setBootstrap} />;
}
