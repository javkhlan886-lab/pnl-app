function initialsOf(name?: string | null): string {
  if (!name) return "PNL";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "PNL";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Компанийн нэрээс автоматаар үүсгэсэн лого — statik зурагны оронд. */
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
  return (
    <div
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-[#d4af37] bg-gradient-to-br from-[#f6dfa0] to-[#b8860b] font-heading font-bold text-[#3a2a05] shadow-[0_0_18px_rgba(212,175,55,0.35)] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initialsOf(name)}
    </div>
  );
}
