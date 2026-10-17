import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

function readTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setMode(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    setMode(readTheme());
    return () => observer.disconnect();
  }, []);

  return mode;
}
