"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  canAccessAdminPath,
  getAdminHomeRoute,
} from "@/lib/staffAccess";

const SYNC_INTERVAL_MS = 5000;

export default function SessionSync() {
  const { data, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const previousSnapshot = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      previousSnapshot.current = null;
      return;
    }

    const sync = () => {
      void update();
    };

    sync();

    const intervalId = window.setInterval(sync, SYNC_INTERVAL_MS);
    const handleFocus = () => sync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        sync();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [status, update]);

  useEffect(() => {
    if (status !== "authenticated" || !data?.user) {
      return;
    }

    const snapshot = JSON.stringify({
      role: data.user.role,
      branchId: data.user.branchId,
      permissions: data.user.permissions,
      isActive: data.user.isActive,
      updatedAt: data.user.updatedAt,
      name: data.user.name,
      email: data.user.email,
      image: data.user.image ?? null,
    });

    const previous = previousSnapshot.current;
    previousSnapshot.current = snapshot;

    if (previous !== null && previous !== snapshot) {
      router.refresh();
    }
  }, [
    data?.user.branchId,
    data?.user.email,
    data?.user.image,
    data?.user.isActive,
    data?.user.name,
    data?.user.permissions,
    data?.user.role,
    data?.user.updatedAt,
    router,
    status,
  ]);

  useEffect(() => {
    if (status !== "authenticated" || !data?.user) {
      return;
    }

    if (!data.user.isActive) {
      void signOut({ callbackUrl: "/login" });
      return;
    }

    if (!canAccessAdminPath(pathname, data.user.role, data.user.permissions)) {
      router.replace(getAdminHomeRoute(data.user.role));
    }
  }, [data?.user, pathname, router, status]);

  return null;
}
