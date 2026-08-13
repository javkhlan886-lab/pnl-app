// Dashboard-ийн статистик талбар бүрийг тус тусад нь нуух/харуулах сонголт —
// browser-т хадгалагдаж, дараагийн удаа нэвтрэхэд хэвээр үлдэнэ.
const KEY = "pnl_dashboard_hidden_fields";

export function getHiddenFields(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveHiddenFields(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable — чимээгүй алгасна.
  }
}
