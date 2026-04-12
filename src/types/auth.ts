import type { UserRole } from "@prisma/client";

export type { UserRole };

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string | null;
  branchId: string | null;
  image?: string | null;
}

export interface AuthSession {
  user: SessionUser;
  expires: string;
}
