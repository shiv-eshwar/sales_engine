import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  parseTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type Theme
} from "./theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(resolveTheme);

  const setTheme = useCallback((next: Theme) => {
    persistTheme(next);
    setThemeState(next);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = parseTheme(event.newValue) ?? resolveTheme();
      applyTheme(next);
      setThemeState(next);
    };
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const onSystem = () => {
      if (readStoredTheme()) return;
      const next = resolveTheme();
      applyTheme(next);
      setThemeState(next);
    };
    window.addEventListener("storage", onStorage);
    media?.addEventListener("change", onSystem);
    return () => {
      window.removeEventListener("storage", onStorage);
      media?.removeEventListener("change", onSystem);
    };
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  const [local, setLocal] = useState<Theme>(resolveTheme);
  if (ctx) return ctx;
  return {
    theme: local,
    setTheme: (next) => {
      persistTheme(next);
      setLocal(next);
    }
  };
}
