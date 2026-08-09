import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
 
export function fmt(amount: number, currency: string) {
  return currency + Math.round(amount).toLocaleString("mn-MN");
}

// Backend-ийн он-сар-өдрийн талбарууд (date/dueDate/purchaseDate/startDate)
// зарим эх сурвалж дээр "YYYY-MM-DD", зарим дээр Prisma-гийн бүтэн ISO
// timestamp ("2026-08-09T00:00:00.000Z") хэлбэрээр ирдэг тул хоёуланг нь
// нэг стандарт "YYYY-MM-DD" болгож задална — хүснэгтэд харуулах болон
// <input type="date"> руу дамжуулахад аль алинд нь ашиглана.
export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

// fmtDate-тэй ижил задаргаа хийдэг ч <input type="date">-д зориулж хоосон
// утгыг "—" биш "" гэж буцаана (эс тэгвэл invalid value алдаа гардаг).
export function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}
 