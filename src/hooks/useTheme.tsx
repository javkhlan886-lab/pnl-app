import { useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "pnl-theme";

// Module-level state — useAuth-тай адил pattern. Хэрэв энэ component-level
// useState байсан бол хуудас бүр (Dashboard, Employee, Login ...) тусдаа
// state-тэй болж, нэг газар toggle хийсэн нь бусдад харагдахгүй байх,
// эсвэл дахин mount хийгдэхэд анхны утга руу буцах эрсдэлтэй байсан.
let currentTheme: Theme = getStoredTheme();
const listeners = new Set<(t: Theme) => void>();

function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "dark"; // анхдагч — dark
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

// main.tsx ачаалах үед нэг удаа эхний theme-ийг тулгана (index.html-ийн
// inline script-ийг нөхөж баталгаажуулна — race condition-оос сэргийлнэ)
applyTheme(currentTheme);

function setGlobalTheme(t: Theme) {
  currentTheme = t;
  localStorage.setItem(STORAGE_KEY, t);
  applyTheme(t);
  listeners.forEach((l) => l(t));
}

export function useTheme() {
  const [theme, setLocalTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    const listener = (t: Theme) => setLocalTheme(t);
    listeners.add(listener);
    // Mount хийгдэх үед global state-тэй синхрончлох (race condition-оос хамгаалах)
    setLocalTheme(currentTheme);
    return () => { listeners.delete(listener); };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setGlobalTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setGlobalTheme(currentTheme === "dark" ? "light" : "dark");
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}
