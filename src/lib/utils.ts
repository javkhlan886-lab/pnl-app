import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
 
export function fmt(amount: number, currency: string) {
  return currency + Math.round(amount).toLocaleString("mn-MN");
}
 