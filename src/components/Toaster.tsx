import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { subscribeToasts, dismissToast, type ToastItem, type ToastVariant } from "@/lib/toast";

const CARD_CLASS: Record<ToastVariant, string> = {
  success: "glass-card glass-card-positive",
  error: "glass-card glass-card-negative",
  info: "glass-card",
};

const ICON_CLASS: Record<ToastVariant, string> = {
  success: "text-positive",
  error: "text-destructive",
  info: "text-info",
};

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

// App.tsx-ийн route wrapper-т нэг удаа рендерлэгдэнэ — хуудас бүрт нэмэх
// шаардлагагүй (ChatSection-той ижил загвар).
export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={`${CARD_CLASS[t.variant]} px-4 py-3 flex items-start gap-2.5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-200`}
          >
            <Icon className={`relative w-4 h-4 shrink-0 mt-0.5 ${ICON_CLASS[t.variant]}`} />
            <p className="relative text-sm text-foreground flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="relative text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
