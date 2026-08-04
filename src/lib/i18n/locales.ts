export type Locale = "mn" | "en" | "ko";

export const LOCALES: { code: Locale; label: string; flagSrc: string; flagScale?: number }[] = [
  { code: "mn", label: "Монгол", flagSrc: "/flags/mn.webp" },
  { code: "en", label: "English", flagSrc: "/flags/en.jpg" },
  { code: "ko", label: "한국어", flagSrc: "/flags/ko.jpg", flagScale: 1.2 },
];

export const DEFAULT_LOCALE: Locale = "mn";

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && LOCALES.some((l) => l.code === value);
}
