import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@heroui/react";
import { AUTH_FIELD_CLASS, AuthShell } from "../components/AuthShell";
import { AUTH_COPY, PAGE_TITLES } from "../copy";
import { login } from "../state/api";
import { usePageTitle } from "../usePageTitle";

type LoginPageProps = {
  onLoggedIn: () => void;
};

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  usePageTitle(PAGE_TITLES.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : AUTH_COPY.signInTitle);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={AUTH_COPY.signInTitle}
      description={AUTH_COPY.signInBody}
      footer={
        <>
          {AUTH_COPY.signInFooter}{" "}
          <Link className="font-semibold text-foreground hover:underline hover:underline-offset-4" to="/signup">
            {AUTH_COPY.signInFooterAction}
          </Link>
        </>
      }
    >
      <form className="mt-8 flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
        <label className="flex flex-col gap-2" htmlFor="email">
          <span className="text-sm font-semibold">{AUTH_COPY.email}</span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={AUTH_FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-2" htmlFor="password">
          <span className="text-sm font-semibold">{AUTH_COPY.password}</span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={AUTH_FIELD_CLASS}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full rounded-lg!" isDisabled={pending} isPending={pending}>
          {pending ? AUTH_COPY.signInPending : AUTH_COPY.signInSubmit}
        </Button>
      </form>
    </AuthShell>
  );
}
