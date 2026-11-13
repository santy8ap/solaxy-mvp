export const THEMES = {
  light: { label: "Claro", background: "#f6f5ee", foreground: "#19251d" },
  dark: { label: "Oscuro", background: "#050505", foreground: "#f2f2f0" },
  green: { label: "Verde", background: "#284c35", foreground: "#ffedaa" },
} as const;

export type ThemeMode = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeMode = "dark";
export const THEME_STORAGE_KEY = "xge:theme";
export const THEME_MODES = Object.keys(THEMES) as ThemeMode[];

export function readTheme(value: string | null | undefined): ThemeMode {
  return value && Object.hasOwn(THEMES, value) ? (value as ThemeMode) : DEFAULT_THEME;
}

// La preferencia se aplica antes de que el navegador pinte el contenido.
export const themeBootScript = `try {
  const mode = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if (${JSON.stringify(THEME_MODES)}.includes(mode)) {
    document.documentElement.dataset.theme = mode;
  }
} catch {}`;
