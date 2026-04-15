import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, toZonedTime } from "date-fns-tz";

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

/** Extract initials from an organisation/branch name (e.g. "Trinitate International School" → "TIS") */
export function nameInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * Build an application number in the format:
 *   {ORG_INITIALS}-{BRANCH_INITIAL}-{YEAR}-{NNNN}
 *   e.g. TIS-B-2026-0001
 */
export function buildApplicationNumber(
  orgName: string,
  branchName: string,
  sequence: number,
): string {
  const year = new Date().getFullYear();
  const orgCode = nameInitials(orgName);
  const branchCode = branchName.trim()[0].toUpperCase();
  const seq = String(sequence).padStart(4, "0");
  return `${orgCode}-${branchCode}-${year}-${seq}`;
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
