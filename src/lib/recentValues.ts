// Хуудас + талбар тус бүрийн сүүлд оруулсан утгуудыг browser-т хадгалж,
// дараагийн удаа Combobox дээр санал болгоно (customCategories.ts-тэй ижил
// хандлага, гэхдээ жагсаалт үргэлж 5-аас ихгүй, хамгийн сүүлийнх нь эхэнд).
const MAX = 5;
const PREFIX = "pnl_recent_";

function storageKey(page: string, field: string): string {
  return `${PREFIX}${page}_${field}`;
}

export function getRecent(page: string, field: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(page, field));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function addRecent(page: string, field: string, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    const existing = getRecent(page, field).filter((v) => v !== trimmed);
    const next = [trimmed, ...existing].slice(0, MAX);
    localStorage.setItem(storageKey(page, field), JSON.stringify(next));
  } catch {
    // localStorage unavailable (privacy mode гэх мэт) — чимээгүй алгасна.
  }
}
