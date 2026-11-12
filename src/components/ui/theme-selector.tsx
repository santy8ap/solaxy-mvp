"use client";

import { Check, ChevronDown, Leaf, Moon, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "@/context/theme-context";
import { THEMES, THEME_MODES, type ThemeMode } from "@/lib/theme";

const themeIcons = { light: Sun, dark: Moon, green: Leaf };

export function ThemeSelector() {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const CurrentIcon = themeIcons[mode];

  useEffect(() => {
    if (!open) return;

    function dismissOutside(event: PointerEvent | FocusEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }

    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  function chooseTheme(next: ThemeMode) {
    setMode(next);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        className="btn btn-ghost min-w-11 gap-2 px-2.5 py-2 sm:px-3"
        aria-label={`Cambiar tema. ${THEMES[mode].label} seleccionado`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((previous) => !previous)}
      >
        <CurrentIcon aria-hidden="true" size={17} strokeWidth={1.6} />
        <span className="hidden sm:inline">Tema</span>
        <ChevronDown aria-hidden="true" size={13} className="hidden sm:block" />
      </button>
      <div
        id={id}
        role="group"
        aria-label="Apariencia"
        hidden={!open}
        className="theme-menu sheet absolute right-0 top-full z-50 mt-2 w-44 p-1.5 text-ink shadow-lg"
      >
        {THEME_MODES.map((choice) => {
          const theme = THEMES[choice];
          const Icon = themeIcons[choice];
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={choice === mode}
              className="theme-choice flex min-h-11 w-full items-center gap-2.5 px-2 text-left text-sm"
              onClick={() => chooseTheme(choice)}
            >
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center border border-line-strong"
                style={{ backgroundColor: theme.background, color: theme.foreground }}
              >
                <Icon size={15} strokeWidth={1.6} />
              </span>
              {theme.label}
              {choice === mode && <Check aria-hidden="true" size={15} className="ml-auto shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
