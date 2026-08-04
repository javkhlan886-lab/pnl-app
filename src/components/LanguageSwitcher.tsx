import { useLocale } from "@/hooks/useLocale";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

const BASE_W = 20;
const BASE_H = 14;

function Flag({ src, label, scale = 1 }: { src: string; label: string; scale?: number }) {
  return (
    <img
      src={src}
      alt={label}
      className="shrink-0 rounded-[2px] border border-border/50 object-cover"
      style={{ width: BASE_W * scale, height: BASE_H * scale }}
    />
  );
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const active = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <SelectTrigger className={`h-9 w-auto gap-1.5 px-2 ${className}`}>
        <Flag src={active.flagSrc} label={active.label} scale={active.flagScale} />
        <span className="hidden sm:inline">{active.label}</span>
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            <span className="flex items-center gap-2">
              <Flag src={l.flagSrc} label={l.label} scale={l.flagScale} />
              {l.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
