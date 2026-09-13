import type { ReactNode } from "react";
import type { ProspectPreparation } from "../../shared/campaigns";
import { Icon, QuoteMark } from "./Icon";

export function ProspectBrief({
  preparation,
  action,
  error,
  compact = false
}: {
  preparation: ProspectPreparation;
  action?: ReactNode;
  error?: string | null;
  compact?: boolean;
}) {
  const { brief, research } = preparation;
  function facts(items: typeof brief.company) {
    return (
      <ul className="mt-3 space-y-2.5 text-sm">
        {items.map((fact, index) => (
          <li key={index} className="flex gap-2">
            <Icon name="check" className="mt-0.5 text-muted" />
            <span>
              {fact.text}{" "}
              {fact.sourceIds.map((id) => {
                const source = research.sources.find((item) => item.id === id);
                return source ? (
                  <a
                    key={id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 font-semibold text-link hover:underline"
                  >
                    [{research.sources.indexOf(source) + 1}]
                  </a>
                ) : null;
              })}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const meta = (
    <div key="meta">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
        <p className="text-sm text-muted">
          {new Date(preparation.generatedAt).toLocaleString()}
          {research.status === "complete" ? " · Cited web research" : " · CRM context only"}
        </p>
        {action}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
      {research.warnings.map((warning, index) => (
        <p key={index} role="status" className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
          {warning}
        </p>
      ))}
    </div>
  );

  const opening = (
    <div key="opening" className={`min-w-0 overflow-hidden rounded-lg bg-accent-soft ${compact ? "p-4" : "p-5"}`}>
      <QuoteMark />
      <p className="mt-3 text-sm leading-relaxed break-words text-accent-soft-foreground">{brief.opening}</p>
    </div>
  );

  const questions = (
    <div key="questions">
      <h3 className="text-sm font-semibold">Questions</h3>
      <p className="mt-1 text-sm text-muted">Follow their answers. These are prompts, not a script.</p>
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
        {brief.questions.map((question) => (
          <li key={question.id}>
            <p className="flex min-w-0 items-start gap-2 font-medium">
              <span className="min-w-0 break-words">{question.prompt}</span>
              {question.required ? <Icon name="flag" className="mt-0.5 text-accent" title="Priority" /> : null}
            </p>
            <p className="mt-1 text-sm text-muted">{question.purpose}</p>
          </li>
        ))}
      </ol>
    </div>
  );

  const factsGrid = brief.company.length > 0 || brief.prospect.length > 0 ? (
    <div key="facts" className={`grid gap-6 ${compact ? "" : "sm:grid-cols-2"}`}>
      <div>
        <h3 className="text-sm font-semibold">Company</h3>
        {brief.company.length ? facts(brief.company) : <p className="mt-2 text-sm text-muted">No sourced company findings.</p>}
      </div>
      <div>
        <h3 className="text-sm font-semibold">Prospect</h3>
        {brief.prospect.length ? facts(brief.prospect) : <p className="mt-2 text-sm text-muted">No sourced prospect findings.</p>}
      </div>
    </div>
  ) : null;

  const relevance = (
    <div key="relevance">
      <h3 className="text-sm font-semibold">Why it may be relevant</h3>
      <p className="mt-2 max-w-[32em] text-sm leading-relaxed text-muted">{brief.relevance}</p>
    </div>
  );

  const hypotheses = brief.hypotheses.length ? (
    <div key="hypotheses">
      <h3 className="text-sm font-semibold">Hypotheses</h3>
      <ul className="mt-3 space-y-2.5 text-sm">
        {brief.hypotheses.map((item, index) => (
          <li key={index} className="flex gap-2">
            <Icon name="check" className="mt-0.5 text-muted" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const objections = brief.objections.length ? (
    <details key="objections">
      <summary className="cursor-pointer text-sm font-semibold">Potential objections & responses</summary>
      <dl className="mt-3 space-y-3 text-sm">
        {brief.objections.map((item, index) => (
          <div key={index}>
            <dt className="font-medium">{item.objection}</dt>
            <dd className="mt-1 text-sm text-muted">{item.response}</dd>
          </div>
        ))}
      </dl>
    </details>
  ) : null;

  const nextStep = (
    <div key="next">
      <h3 className="text-sm font-semibold">Suggested next step</h3>
      <p className="mt-2 max-w-[32em] text-sm leading-relaxed text-muted">{brief.nextStep}</p>
    </div>
  );

  const unknowns = brief.unknowns.length ? (
    <div key="unknowns">
      <h3 className="text-sm font-semibold">Still unknown</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {brief.unknowns.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  ) : null;

  const sources = research.sources.length ? (
    <div key="sources">
      <h3 className="text-sm font-semibold">Research sources</h3>
      <ol className={`mt-2 grid gap-x-8 gap-y-1 p-0 text-sm ${compact ? "" : "sm:grid-cols-2"}`}>
        {research.sources.map((source, index) => (
          <li key={source.id} className="flex gap-2">
            <span className="shrink-0 tabular-nums text-muted">{index + 1}.</span>
            <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-link hover:underline">
              {source.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  ) : null;

  const body = compact
    ? [opening, questions, objections, factsGrid, relevance, hypotheses, nextStep, unknowns, sources]
    : [factsGrid, relevance, hypotheses, opening, questions, objections, nextStep, unknowns, sources];

  return (
    <section
      className={`rounded-lg bg-surface shadow-sm ${compact ? "space-y-6 p-4" : "space-y-8 p-5 sm:p-8"}`}
      aria-label="AI prospect brief"
    >
      {meta}
      {body}
    </section>
  );
}
