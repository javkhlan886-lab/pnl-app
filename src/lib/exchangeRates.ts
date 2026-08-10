// Backend-ийн src/lib/exchange-rates.ts-тэй ижил тогтмол ойролцоо ханш —
// зөвхөн клиент талын жагсаалт fallback (offline/backend алдаатай үед)
// зориулагдсан тул хоёр тал синк байх ёстой.
const MNT_RATES: Record<string, number> = {
  "₮": 1,
  "$": 3450,
  "€": 3750,
  "¥": 480,
};

// overrideRate: an individual report's own manually-entered ханш, takes
// precedence over the fixed table when the currency isn't MNT.
export function toMnt(
  amount: number,
  currency: string | null | undefined,
  overrideRate?: number | null
): number {
  if (currency && currency !== "₮" && overrideRate) return amount * overrideRate;
  const rate = MNT_RATES[currency ?? "₮"] ?? 1;
  return amount * rate;
}

export function defaultRate(currency: string | null | undefined): number {
  return MNT_RATES[currency ?? "₮"] ?? 1;
}
