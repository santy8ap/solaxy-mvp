"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

export interface ThemeMode {
  mode: "light" | "dark" | "green";
  name: string;
}

const ThemeCtx = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void } | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>({
    mode: "light",
    name: "Claro (fondo blanco, letra negra)",
  });

  const themes = {
    light: {
      name: "Claro (fondo blanco, letra negra)",
      class: "bg-white text-black",
    },
    dark: {
      name: "Fondo negro con letras blancas",
      class: "bg-black text-white",
    },
    green: {
      name: "Verde con amarillo",
      class: "bg-green-900 text-yellow-400",
    },
  };

  return (
    <ThemeCtx.Provider value={{ mode, setMode }}>
      <div className={themes[mode.mode].class}>{children}</div>
    </ThemeCtx.Provider>
  );
}
