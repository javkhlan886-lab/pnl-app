// Backend-ийн src/lib/exchange-rates.ts-тэй ижил тогтмол ойролцоо ханш —
// зөвхөн клиент талын жагсаалт fallback (offline/backend алдаатай үед)
// зориулагдсан тул хоёр тал синк байх ёстой.
const MNT_RATES: Record<string, number> = {
  "₮": 1,
  "$": 3450,
  "€": 3750,
  "¥": 480,
};

export function toMnt(amount: number, currency: string | null | undefined): number {
  const rate = MNT_RATES[currency ?? "₮"] ?? 1;
  return amount * rate;
}
