/**
 * Default passwords used when a super admin resets an account.
 * Matches seed credentials so ops can restore known login defaults.
 */
export const DEFAULT_STAFF_PASSWORDS = {
  SCHOOL_ADMIN: "Admin@1234",
  SUPER_ADMIN: "SuperAdmin@1234",
} as const;

export const DEFAULT_APPLICANT_PASSWORD = "Applicant@1234";

export type StaffRoleWithDefault = keyof typeof DEFAULT_STAFF_PASSWORDS;

export function getDefaultStaffPassword(role: StaffRoleWithDefault): string {
  return DEFAULT_STAFF_PASSWORDS[role];
}
