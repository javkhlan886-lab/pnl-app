import * as React from "react";
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

  React.useEffect(() => {
    // pointerdown (mousedown+touchstart-той адил) — mobile browser дээр
    // "mousedown" зарим үед хожимдож/алгасаж бас dropdown хаагдахгүй
    // үлддэг асуудлаас сэргийлнэ.
    function onClickOutside(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, []);

  const filtered = value.trim()
    ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase()))
    : options;

  return (
    <div ref={wrapRef} className="relative">
      <input
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
      {!disabled && open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg py-1">
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
        </div>
      )}
    </div>
  );
}
