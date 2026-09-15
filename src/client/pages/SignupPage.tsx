import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@heroui/react";
import { AUTH_FIELD_CLASS, AuthShell } from "../components/AuthShell";
import { AUTH_COPY, PAGE_TITLES } from "../copy";
import { signup } from "../state/api";
import { usePageTitle } from "../usePageTitle";

type SignupPageProps = {
  onLoggedIn: () => void;
};

export function SignupPage({ onLoggedIn }: SignupPageProps) {
  usePageTitle(PAGE_TITLES.signup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(AUTH_COPY.mismatch);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await signup(email, password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : AUTH_COPY.signUpTitle);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={AUTH_COPY.signUpTitle}
      description={AUTH_COPY.signUpBody}
      footer={
        <>
          {AUTH_COPY.signUpFooter}{" "}
          <Link className="font-semibold text-foreground hover:underline hover:underline-offset-4" to="/login">
            {AUTH_COPY.signUpFooterAction}
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
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2" htmlFor="password">
            <span className="text-sm font-semibold">{AUTH_COPY.password}</span>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby="password-hint"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={AUTH_FIELD_CLASS}
            />
          </label>
          <p id="password-hint" className="text-xs text-muted">
            {AUTH_COPY.passwordHint}
          </p>
        </div>
        <label className="flex flex-col gap-2" htmlFor="confirm-password">
          <span className="text-sm font-semibold">{AUTH_COPY.confirmPassword}</span>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={AUTH_FIELD_CLASS}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full rounded-lg!" isDisabled={pending} isPending={pending}>
          {pending ? AUTH_COPY.signUpPending : AUTH_COPY.signUpSubmit}
        </Button>
      </form>
    </AuthShell>
  );
}
