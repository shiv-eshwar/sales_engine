import type { PublicLastTouch } from "../../shared/contracts";
import { formatLastTouchLine } from "../../shared/lastTouch";

export function LastTouchLine({
  touch,
  summary = false
}: {
  touch: PublicLastTouch | null | undefined;
  summary?: boolean;
}) {
  if (!touch) return null;
  const line = formatLastTouchLine(touch);
  if (!line) return null;
  return (
    <div className="min-w-0" aria-label="Last call">
      <p className="text-sm text-muted">{line}</p>
      {summary && touch.lastSummary ? (
        <p className="mt-1 max-w-[32em] text-sm text-muted line-clamp-2">{touch.lastSummary}</p>
      ) : null}
    </div>
  );
}
