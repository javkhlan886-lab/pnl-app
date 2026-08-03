import { useCallback, useEffect, useState } from "react";

export const BLUR_STORAGE_KEY = "pnl-blur";

let currentBlur = getStoredBlur();
const listeners = new Set<(active: boolean) => void>();

function getStoredBlur() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(BLUR_STORAGE_KEY) === "1";
}

function applyBlur(active: boolean) {
  const root = document.documentElement;
  root.classList.toggle("blurred-values", active);
}

function setGlobalBlur(active: boolean) {
  currentBlur = active;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(BLUR_STORAGE_KEY, active ? "1" : "0");
  }
  applyBlur(active);
  listeners.forEach((listener) => listener(active));
}

applyBlur(currentBlur);

export function useBlur() {
  const [blurred, setBlurred] = useState(currentBlur);

  useEffect(() => {
    const listener = (active: boolean) => setBlurred(active);
    listeners.add(listener);
    setBlurred(currentBlur);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggleBlur = useCallback(() => {
    setGlobalBlur(!currentBlur);
  }, []);

  return {
    blurred,
    setBlur: setGlobalBlur,
    toggleBlur,
  };
}
