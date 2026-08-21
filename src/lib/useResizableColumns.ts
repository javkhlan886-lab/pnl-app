import { useCallback, useEffect, useRef, useState } from "react";

const MIN_WIDTH = 60;
const PREFIX = "pnl_col_widths_";

function storageKey(page: string): string {
  return `${PREFIX}${page}`;
}

function loadWidths(page: string, defaults: Record<string, number>): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(page));
    const saved = raw ? JSON.parse(raw) : {};
    return { ...defaults, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return defaults;
  }
}

// Хуудасны хүснэгтийн багана бүрийн өргөнийг гараар чирж өөрчлөх боломж
// олгоно — browser-т хадгалагдаж, дараагийн удаа нэвтрэхэд хэвээр үлдэнэ
// (dashboardHidden.ts-тэй ижил хандлага, гэхдээ энд page тус бүр өөрийн
// key-гээ дамжуулна, "dashboard" гэсэн онцгой тохиолдол шаардлагагүй).
export function useResizableColumns(page: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(() => loadWidths(page, defaults));
  const dragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const { key, startX, startWidth } = dragRef.current;
    const next = Math.max(MIN_WIDTH, startWidth + (e.clientX - startX));
    setWidths((prev) => ({ ...prev, [key]: next }));
  }, []);

  const onMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setWidths((prev) => {
      try { localStorage.setItem(storageKey(page), JSON.stringify(prev)); } catch { /* noop */ }
      return prev;
    });
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, onMouseMove]);

  const startResize = useCallback((key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { key, startX: e.clientX, startWidth: widths[key] ?? defaults[key] ?? 150 };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widths, onMouseMove, onMouseUp]);

  // Хуудас/цонх устах үед сонсогчдоо цэвэрлэнэ (жагсаалт дунд чирж байхад
  // навигаци хийвэл window listener үлдэхгүй байх).
  useEffect(() => () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { widths, startResize };
}
