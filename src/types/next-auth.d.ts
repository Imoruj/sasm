import type { UserRole } from "@prisma/client";
import type { StaffPermissions } from "@/lib/staffAccess";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: UserRole;
      organizationId: string | null;
      branchId: string | null;
      permissions: StaffPermissions;
      isActive: boolean;
      updatedAt: string;
    };
  }

  interface User {
    role: UserRole;
    organizationId: string | null;
    branchId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    organizationId: string | null;
    branchId: string | null;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    permissions?: StaffPermissions;
    isActive?: boolean;
    updatedAt?: string;
  }
}
