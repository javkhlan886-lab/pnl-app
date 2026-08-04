/** Компанийн нэрээс автоматаар үүсгэсэн лого (бүтэн нэрээр) — statik зурагны оронд. */
export function CompanyLogo({
  name,
  size = 114,
  className = "",
  onClick,
}: {
  name?: string | null;
  size?: number;
  className?: string;
  onClick?: () => void;
}) {
  const label = name?.trim() || "PnL";

  return (
    <div
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center rounded-2xl border-2 border-[#d4af37] bg-gradient-to-br from-[#f6dfa0] to-[#b8860b] px-4 text-center font-heading font-bold leading-tight text-[#3a2a05] shadow-[0_0_18px_rgba(212,175,55,0.35)] ${className}`}
      style={{ minHeight: size * 0.5, maxWidth: size * 2.4, fontSize: Math.max(13, size * 0.16) }}
    >
      <span className="line-clamp-2">{label}</span>
    </div>
  );
}
