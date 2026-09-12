import type { ProspectPreparation } from "../../shared/campaigns";

export function ProspectBrief({ preparation }: { preparation: ProspectPreparation }) {
  const { brief, research } = preparation;
  function facts(items: typeof brief.company) {
    return (
      <ul className="mt-2 space-y-2 text-sm">
        {items.map((fact, index) => (
          <li key={index}>
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
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section className="mt-4 space-y-6 rounded-lg bg-surface p-5 shadow-sm" aria-label="AI prospect brief">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Your call brief</h2>
        <p className="mt-1 text-sm text-muted">
          Generated {new Date(preparation.generatedAt).toLocaleString()} · {research.status === "complete" ? "Includes cited web research" : "CRM context only"}
        </p>
        {research.warnings.map((warning, index) => (
          <p key={index} role="status" className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
            {warning}
          </p>
        ))}
      </div>
      {brief.company.length > 0 || brief.prospect.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Company research</h3>
            {brief.company.length ? facts(brief.company) : <p className="mt-2 text-sm text-muted">No sourced company findings.</p>}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Prospect research</h3>
            {brief.prospect.length ? facts(brief.prospect) : <p className="mt-2 text-sm text-muted">No sourced prospect findings.</p>}
          </div>
        </div>
      ) : null}
      <div>
        <h3 className="text-sm font-semibold">Why this offering may be relevant</h3>
        <p className="mt-2 max-w-[32em] text-sm leading-relaxed text-muted">{brief.relevance}</p>
      </div>
      {brief.hypotheses.length ? (
        <div>
          <h3 className="text-sm font-semibold">Hypotheses to validate</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {brief.hypotheses.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rounded-lg bg-accent-soft p-4">
        <h3 className="text-sm font-semibold text-accent-soft-foreground">Suggested opening</h3>
        <p className="mt-2 text-sm leading-relaxed text-accent-soft-foreground">{brief.opening}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Discovery questions for this prospect</h3>
        <p className="mt-1 text-sm text-muted">Follow their answers; use these as prompts, not a checklist to recite.</p>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
          {brief.questions.map((question) => (
            <li key={question.id}>
              <p className="font-medium">
                {question.prompt}
                {question.required ? <span className="ml-2 text-xs font-semibold text-accent">Priority</span> : null}
              </p>
              <p className="mt-1 text-sm text-muted">{question.purpose}</p>
            </li>
          ))}
        </ol>
      </div>
      {brief.objections.length ? (
        <details>
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
      ) : null}
      <div>
        <h3 className="text-sm font-semibold">Suggested next step</h3>
        <p className="mt-2 max-w-[32em] text-sm leading-relaxed text-muted">{brief.nextStep}</p>
      </div>
      {brief.unknowns.length ? (
        <div>
          <h3 className="text-sm font-semibold">Still unknown</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {brief.unknowns.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {research.sources.length ? (
        <div>
          <h3 className="text-sm font-semibold">Research sources</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {research.sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-link hover:underline">
                  {source.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
