import type { UserRole } from "@prisma/client";

export const STAFF_PERMISSION_KEYS = [
  "applications",
  "forms",
  "exams",
  "communications",
  "reports",
  "settings",
] as const;

export type PermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

export type StaffPermissions = Partial<Record<PermissionKey, boolean>>;

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  applications: true,
  forms: false,
  exams: false,
  communications: false,
  reports: false,
  settings: false,
};

export const PERMISSION_DEFS = [
  { key: "applications", label: "Applications", desc: "View and manage applicant submissions" },
  { key: "forms", label: "Form Builder", desc: "Create and edit admission form templates" },
  { key: "exams", label: "Exams", desc: "Schedule and manage placement test sessions" },
  { key: "communications", label: "Communications", desc: "Send emails and SMS to applicants" },
  { key: "reports", label: "Reports", desc: "View analytics and generate reports" },
  { key: "settings", label: "Settings", desc: "Manage school settings and fee structures" },
] as const;

const ADMIN_FEATURE_PATHS: Array<{ prefix: string; feature: PermissionKey | null }> = [
  { prefix: "/admin/applications", feature: "applications" },
  { prefix: "/admin/forms", feature: "forms" },
  { prefix: "/admin/exams", feature: "exams" },
  { prefix: "/admin/communications", feature: "communications" },
  { prefix: "/admin/reports", feature: "reports" },
  { prefix: "/admin/settings", feature: "settings" },
  { prefix: "/admin/profile", feature: null },
  { prefix: "/admin", feature: null },
];

export function normalizeStaffPermissions(value: unknown): StaffPermissions {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return STAFF_PERMISSION_KEYS.reduce((acc, key) => {
    if (key in record) {
      acc[key] = Boolean(record[key]);
    }
    return acc;
  }, {} as StaffPermissions);
}

export function hasExplicitStaffPermissions(permissions?: StaffPermissions | null): boolean {
  return !!permissions && STAFF_PERMISSION_KEYS.some((key) => Object.prototype.hasOwnProperty.call(permissions, key));
}

export function canAccessStaffFeature(
  role: UserRole,
  permissions: StaffPermissions | null | undefined,
  feature: PermissionKey,
): boolean {
  if (role === "SUPER_ADMIN") {
    return true;
  }

  if (role !== "SCHOOL_ADMIN") {
    return false;
  }

  if (!hasExplicitStaffPermissions(permissions)) {
    return true;
  }

  return Boolean(permissions?.[feature]);
}

export function getAdminHomeRoute(role: UserRole): "/dashboard" | "/admin" | "/super-admin" {
  if (role === "APPLICANT") {
    return "/dashboard";
  }

  return "/admin";
}

export function canAccessAdminPath(
  pathname: string,
  role: UserRole,
  permissions?: StaffPermissions | null,
): boolean {
  if (role === "APPLICANT") {
    return pathname.startsWith("/dashboard");
  }

  if (role === "SUPER_ADMIN") {
    return pathname.startsWith("/admin") || pathname.startsWith("/super-admin");
  }

  if (role !== "SCHOOL_ADMIN") {
    return false;
  }

  if (!pathname.startsWith("/admin")) {
    return false;
  }

  const match = ADMIN_FEATURE_PATHS.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );

  if (!match?.feature) {
    return true;
  }

  return canAccessStaffFeature(role, permissions, match.feature);
}

