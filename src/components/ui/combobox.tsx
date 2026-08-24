import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

// Native <input list> + <datalist> дээр сонголтууд focus/click хийхэд шууд
// гардаггүй (браузер бүрт зан төлөв өөр, ихэвчлэн эхлээд бичих ёстой) —
// үүнийг сонгоход шууд бүх сонголт гарч ирдэг жинхэнэ dropdown-оор сольсон.
export function Combobox({ value, onChange, options, placeholder, className, id, disabled }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number } | null>(null);

  React.useEffect(() => {
    // pointerdown (mousedown+touchstart-той адил) — mobile browser дээр
    // "mousedown" зарим үед хожимдож/алгасаж бас dropdown хаагдахгүй
    // үлддэг асуудлаас сэргийлнэ. Dropdown нь portal-оор document.body руу
    // гардаг тул wrapRef-т биш dropdownRef-т багтах click-ийг ч мөн
    // "дотоод" гэж тооцно.
    function onClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, []);

  // Combobox нь scroll хийдэг modal/хэсгийн ёроолд байрлавал dropdown нь
  // тухайн scroll container-ийн overflow-оор таслагдаж, санал болгож буй
  // утгууд огт харагдахгүй болдог байсан (жишээ нь Гүйлгээ нэмэх цонхны хамгийн
  // сүүлийн "Тэмдэглэл" талбар) — dropdown-ыг document.body руу portal хийж,
  // input-ийн бодит дэлгэц дээрх байрлалаар "position: fixed" болгосноор
  // ямар ч scroll container-т таслагдахгүй болно.
  React.useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom, left: r.left, width: r.width });
    };
    updateRect();
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const filtered = value.trim()
    ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase()))
    : options;

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        className={cn(
          "h-9 w-full px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-70 disabled:cursor-not-allowed",
          className
        )}
      />
      {!disabled && open && filtered.length > 0 && rect && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: rect.top + 4, left: rect.left, width: rect.width, pointerEvents: "auto" }}
          className="z-[9999] max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg py-1"
        >
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-secondary/50",
                opt === value && "text-info font-medium"
              )}
            >
              {opt}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
