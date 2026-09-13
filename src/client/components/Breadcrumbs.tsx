import { Link } from "react-router-dom";

export type Crumb = { label: string; to?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 flex-wrap items-baseline gap-1 text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-baseline gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-muted">
                  /
                </span>
              ) : null}
              {item.to && !last ? (
                <Link to={item.to} className="text-sm font-semibold text-muted hover:text-foreground hover:underline hover:underline-offset-4">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={`min-w-0 ${last ? "truncate font-medium" : "text-sm text-muted"}`}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
