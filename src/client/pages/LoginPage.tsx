import { type FormEvent, useState } from "react";
import { Button } from "@heroui/react";
import { login } from "../state/api";

type LoginPageProps = {
  onLoggedIn: () => void;
};

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Sales Engine</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 max-w-[32em] text-sm leading-relaxed text-muted">Single-user internal tool. Sign in to load the next eligible lead.</p>
      <form className="mt-8 flex flex-col gap-6" onSubmit={(event) => void onSubmit(event)}>
        <label className="flex flex-col gap-2" htmlFor="password">
          <span className="text-sm font-semibold">Password</span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full rounded-lg!" isDisabled={pending} isPending={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
