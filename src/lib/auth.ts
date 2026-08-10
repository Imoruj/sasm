import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/validators/authSchema";
import type { UserRole } from "@prisma/client";
import { normalizeStaffPermissions } from "@/lib/staffAccess";

function isEdgeRuntime() {
  return typeof (globalThis as typeof globalThis & { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined";
}

async function loadFreshSessionUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      organizationId: true,
      branchId: true,
      isActive: true,
      mustChangePassword: true,
      updatedAt: true,
      permissions: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    image: user.avatarUrl ?? null,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId,
    permissions: normalizeStaffPermissions(user.permissions),
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    updatedAt: user.updatedAt.toISOString(),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(db) as any,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { email, password } = validated.data;
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash) return null;
        if (!user.isActive) return null;

        // Account lockout check
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null; // Still locked — return null so NextAuth shows generic error
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
          // Increment failure counter; lock after 5 consecutive failures
          const newAttempts = user.failedLoginAttempts + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newAttempts,
              lockedUntil: newAttempts >= 5
                ? new Date(Date.now() + 30 * 60 * 1000) // 30-minute lockout
                : null,
            },
          });
          return null;
        }

        // Successful login — reset lockout state
        await db.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          organizationId: user.organizationId,
          branchId: user.branchId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.organizationId = (user as { organizationId: string | null }).organizationId;
        token.branchId = (user as { branchId: string | null }).branchId;
        token.name = user.name;
        token.email = user.email;
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
      }

      // Refresh token from DB on explicit update trigger or periodically (every 5 min)
      const tokenAge = token.updatedAt
        ? Date.now() - new Date(token.updatedAt as string).getTime()
        : Infinity;
      const shouldRefresh = trigger === "update" || tokenAge > 5 * 60 * 1000;

      if (shouldRefresh && token.id && !isEdgeRuntime()) {
        const freshUser = await loadFreshSessionUser(token.id as string);
        if (freshUser) {
          token.role = freshUser.role;
          token.organizationId = freshUser.organizationId;
          token.branchId = freshUser.branchId;
          token.name = freshUser.name;
          token.email = freshUser.email;
          token.picture = freshUser.image;
          token.permissions = freshUser.permissions;
          token.isActive = freshUser.isActive;
          token.mustChangePassword = freshUser.mustChangePassword;
          token.updatedAt = new Date().toISOString();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.id) {
        return session;
      }

      session.user.id = token.id as string;

      if (!isEdgeRuntime()) {
        const freshUser = await loadFreshSessionUser(token.id as string);
        if (freshUser) {
          session.user.email = freshUser.email;
          session.user.name = freshUser.name;
          session.user.image = freshUser.image;
          session.user.role = freshUser.role;
          session.user.organizationId = freshUser.organizationId;
          session.user.branchId = freshUser.branchId;
          session.user.permissions = freshUser.permissions;
          session.user.isActive = freshUser.isActive;
          session.user.mustChangePassword = freshUser.mustChangePassword;
          session.user.updatedAt = freshUser.updatedAt;
          return session;
        }
      }

      session.user.email = token.email ?? session.user.email;
      session.user.name = token.name ?? session.user.name;
      session.user.image = token.picture ?? session.user.image ?? null;
      session.user.role = token.role as UserRole;
      session.user.organizationId = token.organizationId as string | null;
      session.user.branchId = token.branchId as string | null;
      session.user.permissions = normalizeStaffPermissions((token as { permissions?: unknown }).permissions);
      session.user.isActive = (token as { isActive?: boolean }).isActive ?? true;
      session.user.mustChangePassword =
        (token as { mustChangePassword?: boolean }).mustChangePassword ?? false;
      session.user.updatedAt = (token as { updatedAt?: string }).updatedAt ?? new Date(0).toISOString();

      return session;
    },
  },
});
