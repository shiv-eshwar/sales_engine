import type { ProspectPreparation } from "../../shared/campaigns";

export function ProspectBrief({ preparation }: { preparation: ProspectPreparation }) {
  const { brief, research } = preparation;
  function facts(items: typeof brief.company) {
    return <ul className="mt-2 space-y-2 text-sm text-slate-700">{items.map((fact, index) => <li key={index}>
      {fact.text}{" "}
      {fact.sourceIds.map(id => {
        const source = research.sources.find(item => item.id === id);
        return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer" className="ml-1 text-indigo-700 underline">[{research.sources.indexOf(source) + 1}]</a> : null;
      })}
    </li>)}</ul>;
  }
  return (
    <section className="mt-5 space-y-5 rounded-lg border border-indigo-200 bg-white p-5" aria-label="AI prospect brief">
      <div>
        <h2 className="text-lg font-semibold">Your call brief</h2>
        <p className="mt-1 text-xs text-slate-500">Generated {new Date(preparation.generatedAt).toLocaleString()} · {research.status === "complete" ? "Includes cited web research" : "CRM context only"}</p>
        {research.warnings.map((warning, index) => <p key={index} role="status" className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
      </div>
      {(brief.company.length > 0 || brief.prospect.length > 0) ? <div className="grid gap-5 sm:grid-cols-2">
        <div><h3 className="text-sm font-semibold">Company research</h3>{brief.company.length ? facts(brief.company) : <p className="mt-2 text-sm text-slate-500">No sourced company findings.</p>}</div>
        <div><h3 className="text-sm font-semibold">Prospect research</h3>{brief.prospect.length ? facts(brief.prospect) : <p className="mt-2 text-sm text-slate-500">No sourced prospect findings.</p>}</div>
      </div> : null}
      <div><h3 className="text-sm font-semibold">Why this offering may be relevant</h3><p className="mt-2 text-sm text-slate-700">{brief.relevance}</p></div>
      {brief.hypotheses.length ? <div><h3 className="text-sm font-semibold">Hypotheses to validate</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{brief.hypotheses.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
      <div className="rounded-md bg-indigo-50 p-4"><h3 className="text-sm font-semibold">Suggested opening</h3><p className="mt-2 text-sm text-slate-800">{brief.opening}</p></div>
      <div>
        <h3 className="text-sm font-semibold">Discovery questions for this prospect</h3>
        <p className="mt-1 text-xs text-slate-500">Follow their answers; use these as prompts, not a checklist to recite.</p>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">{brief.questions.map(question => <li key={question.id}>
          <p className="font-medium">{question.prompt}{question.required ? <span className="ml-2 text-xs font-normal text-indigo-700">Priority</span> : null}</p>
          <p className="mt-1 text-slate-500">{question.purpose}</p>
        </li>)}</ol>
      </div>
      {brief.objections.length ? <details><summary className="cursor-pointer text-sm font-semibold">Potential objections & responses</summary><dl className="mt-3 space-y-3 text-sm">{brief.objections.map((item, index) => <div key={index}><dt className="font-medium">{item.objection}</dt><dd className="mt-1 text-slate-600">{item.response}</dd></div>)}</dl></details> : null}
      <div><h3 className="text-sm font-semibold">Suggested next step</h3><p className="mt-2 text-sm text-slate-700">{brief.nextStep}</p></div>
      {brief.unknowns.length ? <div><h3 className="text-sm font-semibold">Still unknown</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{brief.unknowns.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
      {research.sources.length ? <div><h3 className="text-sm font-semibold">Research sources</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{research.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer" className="text-indigo-700 underline">{source.title}</a></li>)}</ol></div> : null}
    </section>
  );
}
