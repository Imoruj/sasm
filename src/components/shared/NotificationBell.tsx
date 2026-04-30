"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, Loader2, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationCategory =
  | "APPLICATION_UPDATE"
  | "EXAM"
  | "PAYMENT"
  | "RESULT"
  | "SYSTEM"
  | "REMINDER";

interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

const CATEGORY_CONFIG: Record<NotificationCategory, { icon: string; bg: string }> = {
  APPLICATION_UPDATE: { icon: "📋", bg: "bg-blue-50" },
  EXAM:               { icon: "📅", bg: "bg-purple-50" },
  PAYMENT:            { icon: "💳", bg: "bg-green-50" },
  RESULT:             { icon: "📊", bg: "bg-orange-50" },
  SYSTEM:             { icon: "⚙️", bg: "bg-gray-100" },
  REMINDER:           { icon: "🔔", bg: "bg-yellow-50" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationBell({
  initialUnreadCount = 0,
}: {
  initialUnreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Fetch recent notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=6");
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data.notifications);
        setUnreadCount(json.data.unreadCount);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll unread count every 60 seconds when popover is closed
  useEffect(() => {
    const poll = async () => {
      if (open) return;
      try {
        const res = await fetch("/api/notifications?limit=1");
        const json = await res.json();
        if (json.success) setUnreadCount(json.data.unreadCount);
      } catch {
        // silently ignore
      }
    };
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [open]);

  // Fetch when popover opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function markAsRead(id: string) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silently ignore
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silently ignore
    } finally {
      setMarkingAll(false);
    }
  }

  const cfg = (cat: string) =>
    CATEGORY_CONFIG[cat as NotificationCategory] ?? CATEGORY_CONFIG.SYSTEM;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100 transition-colors outline-none"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unreadCount > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-red-500 p-0 text-[10px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs text-gray-500 hover:text-gray-800"
              onClick={markAllAsRead}
              disabled={markingAll}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              {markingAll ? "Marking…" : "Mark all read"}
            </Button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-4">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
                🔔
              </div>
              <p className="text-sm font-medium text-gray-700">No notifications yet</p>
              <p className="mt-0.5 text-xs text-gray-400">
                We'll notify you when something happens.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markAsRead(n.id)}
                className={cn(
                  "w-full text-left flex items-start gap-3 px-4 py-3 transition-colors",
                  n.isRead
                    ? "bg-white hover:bg-gray-50"
                    : "bg-blue-50/50 hover:bg-blue-50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm",
                    cfg(n.category).bg
                  )}
                >
                  {cfg(n.category).icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p
                      className={cn(
                        "text-xs leading-snug line-clamp-1",
                        n.isRead
                          ? "font-normal text-gray-700"
                          : "font-semibold text-gray-900"
                      )}
                    >
                      {n.title}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {timeAgo(n.createdAt)}
                      </span>
                      {!n.isRead && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                    {n.message}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2.5 bg-gray-50/80">
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-primary hover:underline"
          >
            View all notifications →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
