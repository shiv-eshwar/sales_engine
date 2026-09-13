/** Full-bleed operator canvas: padding only, no centered max-width island. */
export const SHELL_X =
  "w-full pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))]";

export const SHELL = `mx-auto ${SHELL_X}`;

/**
 * Call job stays a readable measure; supporting work (queue, brief, diagnostics)
 * takes the remaining width. Stack below `lg`. On large screens the row fills
 * the leftover viewport so each pane scrolls on its own.
 */
export const SPLIT =
  "grid min-h-0 flex-1 grid-cols-1 items-stretch gap-6 pb-[5.5rem] lg:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-8 lg:overflow-hidden lg:pb-0";

export const SPLIT_RAIL =
  "flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:overflow-hidden";

/** Themed thin scrollbar (tailwind-scrollbar). Pair with overflow-y-auto / overflow-x-auto. */
export const SCROLLBAR =
  "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border scrollbar-hover:scrollbar-thumb-muted";

export const SCROLL = `overflow-y-auto overscroll-contain [overflow-anchor:none] ${SCROLLBAR}`;

export const SCROLL_X = `overflow-x-auto overscroll-contain ${SCROLLBAR}`;

export const SPLIT_PANE =
  `flex min-h-0 min-w-0 flex-col gap-6 [overflow-anchor:none] lg:h-full lg:min-h-0 ${SCROLL}`;

export function isWorkspacePath(pathname: string): boolean {
  return pathname === "/leads" || /^\/leads\/[^/]+$/.test(pathname);
}
