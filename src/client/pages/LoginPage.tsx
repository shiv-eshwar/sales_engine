import { type FormEvent, useState } from "react";
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
      <h1 className="text-2xl font-semibold tracking-tight">AI Call Operator</h1>
      <p className="mt-2 text-sm text-slate-600">Single-user internal tool. Sign in to load the next eligible lead.</p>
      <form className="mt-8 space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <label className="block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
        />
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
