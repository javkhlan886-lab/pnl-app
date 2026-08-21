// Хуудасны статистик талбар бүрийг тус тусад нь нуух/харуулах сонголт —
// browser-т хадгалагдаж, дараагийн удаа нэвтрэхэд хэвээр үлдэнэ. Анх зөвхөн
// Dashboard дээр байсан тул "dashboard" page-ийн key нь хуучин утгатайгаа
// яг адилхан үлдсэн (одоо байгаа хэрэглэгчдийн хадгалсан төлөв алдагдахгүй) —
// бусад хуудсууд page нэрээ дамжуулж өөрийн тусдаа key-гээр хадгална.
const KEY_PREFIX = "pnl_dashboard_hidden_fields";
const SECTIONS_KEY_PREFIX = "pnl_dashboard_collapsed_sections";

function hiddenKey(page: string): string {
  return page === "dashboard" ? KEY_PREFIX : `${KEY_PREFIX}_${page}`;
}

function sectionsKey(page: string): string {
  return page === "dashboard" ? SECTIONS_KEY_PREFIX : `${SECTIONS_KEY_PREFIX}_${page}`;
}

export function getHiddenFields(page: string = "dashboard"): Set<string> {
  try {
    const raw = localStorage.getItem(hiddenKey(page));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveHiddenFields(ids: Set<string>, page: string = "dashboard"): void {
  try {
    localStorage.setItem(hiddenKey(page), JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable — чимээгүй алгасна.
  }
}

// Бүхэл бүлэг (Ерөнхий үзүүлэлт, Зардлын задаргаа г.м) хураангуйлагдсан эсэх.
export function getCollapsedSections(page: string = "dashboard"): Set<string> {
  try {
    const raw = localStorage.getItem(sectionsKey(page));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveCollapsedSections(ids: Set<string>, page: string = "dashboard"): void {
  try {
    localStorage.setItem(sectionsKey(page), JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable — чимээгүй алгасна.
  }
}

// "Ерөнхий үзүүлэлт" ба "Тайлангуудын нийт дүн" хоёр талбарын харагдах
// дараалал (аль нь дээр байхыг) хэрэглэгч солиод хадгалдаг.
const ORDER_KEY_PREFIX = "pnl_dashboard_reports_total_on_top";

function orderKey(page: string): string {
  return page === "dashboard" ? ORDER_KEY_PREFIX : `${ORDER_KEY_PREFIX}_${page}`;
}

export function getReportsTotalOnTop(page: string = "dashboard"): boolean {
  try {
    return localStorage.getItem(orderKey(page)) === "1";
  } catch {
    return false;
  }
}

export function saveReportsTotalOnTop(value: boolean, page: string = "dashboard"): void {
  try {
    localStorage.setItem(orderKey(page), value ? "1" : "0");
  } catch {
    // localStorage unavailable — чимээгүй алгасна.
  }
}
