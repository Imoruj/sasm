import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccessAdminPath } from "@/lib/staffAccess";
import type { StaffPermissions } from "@/lib/staffAccess";

const AUTH_ROUTES = ["/login", "/register", "/verify", "/forgot-password", "/reset-password"];

export default auth((req: NextRequest & { auth: { user?: { role?: string; permissions?: StaffPermissions; branchId?: string | null } } | null }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;
  const permissions = (session?.user?.permissions ?? null) as StaffPermissions | null;

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    const dest =
      role === "SUPER_ADMIN"
        ? "/super-admin"
        : role === "SCHOOL_ADMIN"
          ? "/admin"
          : "/dashboard";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // Redirect staff hitting the dashboard root to their own portal
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (role === "SUPER_ADMIN") return NextResponse.redirect(new URL("/super-admin", req.url));
    if (role === "SCHOOL_ADMIN") return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Protect all other dashboard routes — staff can access sub-pages as applicant parents
  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
  }

  // Protect admin routes with permission checks
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "SCHOOL_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // For school admins, enforce feature-level permissions
    if (role === "SCHOOL_ADMIN") {
      const allowed = canAccessAdminPath(pathname, role, permissions);
      if (!allowed) return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  // Protect super-admin routes
  if (pathname.startsWith("/super-admin")) {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};
