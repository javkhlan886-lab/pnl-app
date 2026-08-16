// Бяцхан toast мэдэгдлийн систем — native alert()-ийг орлуулна. Sonner гэх мэт
// шинэ dependency нэмэхийн оронд module-level pub/sub (useLocale.tsx-тэй
// ижил хэв маяг) ашиглаж, аль ч компонент/hook-оос гадуур (event handler
// дотор) шууд дуудаж болохоор хийсэн — alert(msg) -> toast.error(msg)
// шилжилтийг 1:1 хийхэд зориулагдсан.
export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const DURATION_MS = 5000;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  listeners.forEach((fn) => fn(items));
}

function push(message: string, variant: ToastVariant) {
  const id = nextId++;
  items = [...items, { id, message, variant }];
  emit();
  setTimeout(() => dismissToast(id), DURATION_MS);
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(fn: (items: ToastItem[]) => void): () => void {
  listeners.add(fn);
  fn(items);
  return () => listeners.delete(fn);
}

export const toast = {
  success: (message: string) => push(message, "success"),
  error: (message: string) => push(message, "error"),
  info: (message: string) => push(message, "info"),
};
