import { useSyncExternalStore } from "react";

// ─── Апп даяар хэрэглэгддэг layout горим ("topnav" эсвэл "sidebar") ─────────
// Dashboard дээрх "Page" товч үүнийг ажиллуулна — бүх хуудас нэг мөчид
// солигдоно (App-ийн route wrapper биш тул React context ашиглахгүй,
// aiPageContext.ts-тэй ижил жижиг модул-хэмжээний store ашиглана).
export type LayoutMode = "topnav" | "sidebar";

const KEY = "pnl_layout_mode";

function readInitial(): LayoutMode {
  try {
    return localStorage.getItem(KEY) === "sidebar" ? "sidebar" : "topnav";
  } catch {
    return "topnav";
  }
}

let current: LayoutMode = readInitial();
const listeners = new Set<() => void>();

export function getLayoutMode(): LayoutMode {
  return current;
}

export function setLayoutMode(mode: LayoutMode): void {
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // localStorage unavailable — зөвхөн энэ session-д хэрэгжинэ.
  }
  listeners.forEach((l) => l());
}

export function toggleLayoutMode(): void {
  setLayoutMode(current === "sidebar" ? "topnav" : "sidebar");
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, getLayoutMode, () => "topnav");
}
