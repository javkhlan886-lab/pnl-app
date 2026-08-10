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

// Хэрэглэгчийн гараар хадгалсан ханш — browser-т хадгалагдаж, дараагийн
// шинэ тайлан үүсгэхэд тухайн валютын анхны утга болно (customCategories.ts
// -тэй ижил хандлага).
const SAVED_RATE_PREFIX = "pnl_saved_rate_";

export function getSavedRate(currency: string): number | null {
  try {
    const raw = localStorage.getItem(SAVED_RATE_PREFIX + currency);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveRate(currency: string, rate: number): void {
  if (!(rate > 0)) return;
  try {
    localStorage.setItem(SAVED_RATE_PREFIX + currency, String(rate));
  } catch {
    // localStorage unavailable (privacy mode гэх мэт) — чимээгүй алгасна.
  }
}
