// "Таны туслах байна" товчийг чирж хөдөлгөсөн байрлалыг browser-т
// хадгална (backend схем өөрчлөхгүйгээр) — дараагийн удаа ачаалахад
// яг тэр байрлалдаа гарч ирнэ. Хадгалаагүй бол анхны CSS байрлал
// (баруун доод булан) хэвээр үлдэнэ.
const KEY = "pnl_chat_fab_pos";

export interface FabPosition {
  x: number;
  y: number;
}

export function getFabPosition(): FabPosition | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.x === "number" && typeof parsed?.y === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveFabPosition(pos: FabPosition): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pos));
  } catch {
    // localStorage unavailable (privacy mode гэх мэт) — чимээгүй алгасна.
  }
}
