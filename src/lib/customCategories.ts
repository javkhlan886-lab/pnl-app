// Компанийн хэрэглэгчийн нэмж оруулсан шинэ ангилалуудыг browser-т хадгална
// (backend схем өөрчлөхгүйгээр) — дараагийн удаа нээхэд сонголтод харагдана.
const STORAGE_PREFIX = "pnl_custom_categories_";

export function getCustomCategories(module: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + module);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export function addCustomCategory(module: string, category: string): void {
  const trimmed = category.trim();
  if (!trimmed) return;
  try {
    const existing = getCustomCategories(module);
    if (existing.includes(trimmed)) return;
    localStorage.setItem(STORAGE_PREFIX + module, JSON.stringify([...existing, trimmed]));
  } catch {
    // localStorage unavailable (privacy mode гэх мэт) — чимээгүй алгасна.
  }
}

export function mergeCategories(defaults: string[], module: string): string[] {
  const custom = getCustomCategories(module);
  return [...defaults, ...custom.filter((c) => !defaults.includes(c))];
}
