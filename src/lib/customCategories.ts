// Компанийн хэрэглэгчийн нэмж оруулсан шинэ ангилалуудыг browser-т хадгална
// (backend схем өөрчлөхгүйгээр) — дараагийн удаа нээхэд сонголтод харагдана.
const STORAGE_PREFIX = "pnl_custom_categories_";
// Хамгийн сүүлд ашигласан ангилал (үндсэн болон custom аль аль нь) хамгийн
// түрүүнд харагддаг байхын тулд тусад нь recency жагсаалт хөтөлнө —
// recentValues.ts-тэй ижил хандлага, гэхдээ энд "ангилал" гэсэн тусгай мод.
const RECENT_PREFIX = "pnl_recent_category_";
const MAX_RECENT = 10;

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

function getRecentCategories(module: string): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PREFIX + module);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

function markCategoryRecent(module: string, category: string): void {
  try {
    const existing = getRecentCategories(module).filter((c) => c !== category);
    localStorage.setItem(RECENT_PREFIX + module, JSON.stringify([category, ...existing].slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable (privacy mode гэх мэт) — чимээгүй алгасна.
  }
}

export function addCustomCategory(module: string, category: string): void {
  const trimmed = category.trim();
  if (!trimmed) return;
  try {
    const existing = getCustomCategories(module);
    if (!existing.includes(trimmed)) {
      localStorage.setItem(STORAGE_PREFIX + module, JSON.stringify([...existing, trimmed]));
    }
  } catch {
    // localStorage unavailable (privacy mode гэх мэт) — чимээгүй алгасна.
  }
  markCategoryRecent(module, trimmed);
}

export function mergeCategories(defaults: string[], module: string): string[] {
  const custom = getCustomCategories(module);
  const all = [...defaults, ...custom.filter((c) => !defaults.includes(c))];
  const recent = getRecentCategories(module).filter((c) => all.includes(c));
  const rest = all.filter((c) => !recent.includes(c));
  return [...recent, ...rest];
}
