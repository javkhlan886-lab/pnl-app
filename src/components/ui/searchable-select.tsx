import * as React from "react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (id: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
}

// Combobox-той ижил dropdown/click-outside зан төлөвтэй, гэхдээ чөлөөт текст
// биш id-аар сонголт хийдэг (жагсаалт томроход plain <select> ашиглахад
// хайх боломжгүй болдог үйлчлүүлэгч/бараа сонголтод зориулав).
export function SearchableSelect({ value, onChange, options, placeholder, className }: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, []);

  const selected = options.find((o) => o.id === value);
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={open ? query : selected?.label ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => setQuery(e.target.value)}
        className={cn(
          "h-9 w-full px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring",
          className
        )}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg py-1">
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onChange(opt.id); setOpen(false); setQuery(""); }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-secondary/50",
                opt.id === value && "text-info font-medium"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
