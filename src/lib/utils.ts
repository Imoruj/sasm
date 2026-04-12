import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, toZonedTime } from "date-fns-tz";
import { customAlphabet } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format kobo amount as Nigerian Naira string (e.g. ₦1,500.00) */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(naira);
}

/** Format Date to WAT (West Africa Time, UTC+1) */
export function formatDate(date: Date | string, fmt = "dd MMM yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const wat = toZonedTime(d, "Africa/Lagos");
  return format(wat, fmt, { timeZone: "Africa/Lagos" });
}

/** Format Date+Time to WAT */
export function formatDateTime(date: Date | string): string {
  return formatDate(date, "dd MMM yyyy, h:mm a");
}

const nanoidGen = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);

/** Generate application number like SAMS-2026-AB1234 */
export function generateApplicationNumber(): string {
  const year = new Date().getFullYear();
  return `SAMS-${year}-${nanoidGen()}`;
}

/** Convert Nigerian phone to E.164 format */
export function normalizeNigerianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("234")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+234${cleaned.slice(1)}`;
  return `+234${cleaned}`;
}

/** Truncate text with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

/** Convert bytes to human-readable size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
