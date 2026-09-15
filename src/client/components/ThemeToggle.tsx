import { Button } from "@heroui/react";
import { NAV_COPY, SETTINGS_COPY } from "../copy";
import { useTheme } from "../ThemeProvider";
import "../layout/header.css";
import { Icon } from "./Icon";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? NAV_COPY.themeToDark : NAV_COPY.themeToLight;
  return (
    <button
      type="button"
      className={`header-icon-link ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="text-current" size={20} />
    </button>
  );
}

export function ThemePair() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button
        variant={theme === "light" ? "primary" : "outline"}
        className="min-h-11 rounded-lg!"
        onPress={() => setTheme("light")}
      >
        {SETTINGS_COPY.appearance.light}
      </Button>
      <Button
        variant={theme === "dark" ? "primary" : "outline"}
        className="min-h-11 rounded-lg!"
        onPress={() => setTheme("dark")}
      >
        {SETTINGS_COPY.appearance.dark}
      </Button>
    </div>
  );
}
