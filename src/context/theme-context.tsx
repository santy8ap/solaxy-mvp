"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_THEME, readTheme, THEMES, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

const ThemeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void } | null>(null);

function getSnapshot() {
  return readTheme(document.documentElement.dataset.theme);
}

function getServerSnapshot() {
  return DEFAULT_THEME;
}

function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });

  function syncStorage(event: StorageEvent) {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      document.documentElement.dataset.theme = readTheme(event.newValue);
    }
  }

  window.addEventListener("storage", syncStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", syncStorage);
  };
}

function setMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // El tema sigue activo en la sesión si el navegador bloquea el almacenamiento.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      <meta name="theme-color" content={THEMES[mode].background} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return context;
}
