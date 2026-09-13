import type { ReactNode } from "react";
import type { ProspectPreparation } from "../../shared/campaigns";
import { SCROLL } from "../layout/shell";
import { Icon, QuoteMark } from "./Icon";

type SourcedFact = ProspectPreparation["brief"]["company"][number];

function FactColumn({
  title,
  facts,
  research
}: {
  title: string;
  facts: SourcedFact[];
  research: ProspectPreparation["research"];
}) {
  if (!facts.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {facts.map((fact, index) => (
          <li key={index} className="flex gap-2">
            <Icon name="check" className="mt-0.5 shrink-0 text-muted" />
            <span className="min-w-0 break-words">
              {fact.text}
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
    </div>
  );
}

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
      <p className="text-xs font-semibold tracking-wide text-accent-soft-foreground/80">Say this</p>
      <QuoteMark />
      <p className="mt-3 text-sm leading-relaxed break-words text-accent-soft-foreground">{brief.opening}</p>
    </div>
  );

  const facts = brief.company.length || brief.prospect.length ? (
    <div key="facts" className="grid gap-6 sm:grid-cols-2">
      <FactColumn title="Company" facts={brief.company} research={research} />
      <FactColumn title="Prospect" facts={brief.prospect} research={research} />
    </div>
  ) : null;

  const questions = (
    <div key="questions">
      <h3 className="text-sm font-semibold">Ask this</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        {brief.questions.map((question) => (
          <li key={question.id} className="min-w-0 pl-1">
            <p className="flex min-w-0 items-start gap-2 font-medium">
              <span className="min-w-0 break-words">{question.prompt}</span>
              {question.required ? <Icon name="flag" className="mt-0.5 text-accent" title="Priority" /> : null}
            </p>
            {question.purpose ? <p className="mt-1 text-sm text-muted">{question.purpose}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );

  const objections = brief.objections.length ? (
    <div key="objections">
      <h3 className="text-sm font-semibold">If they push back</h3>
      <dl className="mt-3 space-y-3 text-sm">
        {brief.objections.map((item, index) => (
          <div key={index}>
            <dt className="font-medium">{item.objection}</dt>
            <dd className="mt-1 text-sm text-muted">{item.response}</dd>
          </div>
        ))}
      </dl>
    </div>
  ) : null;

  const nextStep = (
    <div key="next">
      <h3 className="text-sm font-semibold">Leave with</h3>
      <p className="mt-2 max-w-[32em] text-sm leading-relaxed text-muted">{brief.nextStep}</p>
    </div>
  );

  const extra = (
    <details key="extra" className="text-sm">
      <summary className="cursor-pointer font-semibold">More context</summary>
      <div className="mt-4 space-y-5">
        {brief.relevance ? (
          <div>
            <h4 className="font-medium">Why it may be relevant</h4>
            <p className="mt-1 max-w-[32em] leading-relaxed text-muted">{brief.relevance}</p>
          </div>
        ) : null}
        {brief.hypotheses.length ? (
          <div>
            <h4 className="font-medium">Hypotheses</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {brief.hypotheses.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        {brief.unknowns.length ? (
          <div>
            <h4 className="font-medium">Still unknown</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {brief.unknowns.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        {research.sources.length ? (
          <div>
            <h4 className="font-medium">Research sources</h4>
            <ol className="mt-2 grid gap-x-8 gap-y-1 p-0">
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
        ) : null}
      </div>
    </details>
  );

  const hasExtra = Boolean(brief.relevance || brief.hypotheses.length || brief.unknowns.length || research.sources.length);
  const body = [opening, facts, questions, objections, nextStep, hasExtra ? extra : null];

  if (compact) {
    return (
      <section className="space-y-6 rounded-lg bg-surface p-4 shadow-sm" aria-label="AI prospect brief">
        {meta}
        {body}
      </section>
    );
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-surface shadow-sm"
      aria-label="AI prospect brief"
      data-brief-state="ready"
    >
      <div className="shrink-0 px-5 pt-5 sm:px-8 sm:pt-8">{meta}</div>
      <div className={`min-h-0 flex-1 ${SCROLL} px-5 pb-5 pt-8 sm:px-8 sm:pb-8`}>
        <div className="space-y-8">{body}</div>
      </div>
    </section>
  );
}
