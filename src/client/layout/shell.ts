/** Full-bleed operator canvas: padding only, no centered max-width island. */
export const SHELL_X = "w-full px-4 sm:px-6 lg:px-8";

export const SHELL = `mx-auto ${SHELL_X}`;

/**
 * Call job stays a readable measure; supporting work (queue, brief, diagnostics)
 * takes the remaining width. Stack below `lg`.
 */
export const SPLIT =
  "grid items-start gap-8 lg:grid-cols-[minmax(22rem,32rem)_minmax(0,1fr)]";

export const SPLIT_RAIL = "min-w-0 lg:sticky lg:top-[4.75rem]";
