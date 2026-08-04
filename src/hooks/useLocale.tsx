import { useState, useEffect, useCallback } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionary-type";
import { mn } from "@/lib/i18n/dictionaries/mn";
import { en } from "@/lib/i18n/dictionaries/en";
import { ko } from "@/lib/i18n/dictionaries/ko";

const DICTIONARIES: Record<Locale, Dictionary> = { mn, en, ko };
const STORAGE_KEY = "pnl-locale";

// Same module-level-state pattern as useTheme — a component-level useState
// would leave every open page with its own stale locale until remount.
let currentLocale: Locale = getStoredLocale();
const listeners = new Set<(l: Locale) => void>();

function getStoredLocale(): Locale {
  if (typeof localStorage === "undefined") return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const browser = navigator.language?.slice(0, 2);
  if (isLocale(browser)) return browser;
  return DEFAULT_LOCALE;
}

function setGlobalLocale(l: Locale) {
  currentLocale = l;
  localStorage.setItem(STORAGE_KEY, l);
  listeners.forEach((fn) => fn(l));
}

export function useLocale() {
  const [locale, setLocalLocale] = useState<Locale>(currentLocale);

  useEffect(() => {
    const listener = (l: Locale) => setLocalLocale(l);
    listeners.add(listener);
    setLocalLocale(currentLocale);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setLocale = useCallback((l: Locale) => setGlobalLocale(l), []);

  return { locale, setLocale, t: DICTIONARIES[locale] };
}

/** Reads the current dictionary outside a component (e.g. plain lib functions like logout()). */
export function getCurrentDictionary(): Dictionary {
  return DICTIONARIES[currentLocale];
}

/** Interpolates `{placeholder}` tokens, e.g. format(t.foo.bar, { name }). */
export function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}
