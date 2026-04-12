import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      organizationId: string | null;
      branchId: string | null;
      image?: string | null;
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
  }
}
