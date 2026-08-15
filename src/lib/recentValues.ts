// Хуудас + талбар тус бүрийн өмнө оруулсан утгуудыг browser-т хадгалж,
// дараагийн удаа Combobox дээр санал болгоно (customCategories.ts-тэй ижил
// хандлага). Жагсаалт үргэлж 30-аас ихгүй, хамгийн олон удаа ашигласан
// утгууд эхэнд, ижил давтамжтай бол хамгийн сүүлд ашигласан нь түрүүлнэ.
const MAX = 30;
const PREFIX = "pnl_recent_";

interface Entry {
  value: string;
  count: number;
  lastUsed: number;
}

function storageKey(page: string, field: string): string {
  return `${PREFIX}${page}_${field}`;
}

// Хуучин хувилбар зүгээр string[] хадгалдаг байсан — уналгагүй уншиж,
// анхны эрэмбийг нь (хамгийн сүүлийнх нь эхэнд) lastUsed-ээр илэрхийлнэ.
function normalizeEntries(raw: unknown): Entry[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const entries: Entry[] = [];
  raw.forEach((item, i) => {
    if (typeof item === "string") {
      entries.push({ value: item, count: 1, lastUsed: now - i });
    } else if (item && typeof item === "object" && typeof (item as { value?: unknown }).value === "string") {
      const e = item as Partial<Entry> & { value: string };
      entries.push({
        value: e.value,
        count: typeof e.count === "number" ? e.count : 1,
        lastUsed: typeof e.lastUsed === "number" ? e.lastUsed : now - i,
      });
    }
  });
  return entries;
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
}

function getEntries(page: string, field: string): Entry[] {
  try {
    const raw = localStorage.getItem(storageKey(page, field));
    if (!raw) return [];
    return normalizeEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function getRecent(page: string, field: string): string[] {
  return sortEntries(getEntries(page, field)).map((e) => e.value);
}

export function addRecent(page: string, field: string, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    const entries = getEntries(page, field);
    const existing = entries.find((e) => e.value === trimmed);
    if (existing) {
      existing.count += 1;
      existing.lastUsed = Date.now();
    } else {
      entries.push({ value: trimmed, count: 1, lastUsed: Date.now() });
    }
    const next = sortEntries(entries).slice(0, MAX);
    localStorage.setItem(storageKey(page, field), JSON.stringify(next));
  } catch {
    // localStorage unavailable (privacy mode гэх мэт) — чимээгүй алгасна.
  }
}
