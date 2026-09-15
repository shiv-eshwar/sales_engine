export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "mantis-theme";

export function parseTheme(value: string | null | undefined): Theme | null {
  return value === "dark" || value === "light" ? value : null;
}

export function prefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readStoredTheme(): Theme | null {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? (prefersDark() ? "dark" : "light");
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

export function persistTheme(theme: Theme): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Private mode can block storage; still apply the in-memory theme.
  }
  applyTheme(theme);
}
