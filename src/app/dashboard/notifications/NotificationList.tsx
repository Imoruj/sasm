"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationCategory =
  | "APPLICATION_UPDATE"
  | "EXAM"
  | "PAYMENT"
  | "RESULT"
  | "SYSTEM"
  | "REMINDER";

export interface NotificationItem {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  isRead: boolean;
  readAt: Date | string | null;
  createdAt: Date | string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

type CategoryConfig = {
  icon: string;
  bg: string;
  text: string;
  label: string;
};

const CATEGORY_CONFIG: Record<NotificationCategory, CategoryConfig> = {
  APPLICATION_UPDATE: {
    icon: "📋",
    bg: "bg-blue-50",
    text: "text-blue-700",
    label: "Application",
  },
  EXAM: {
    icon: "📅",
    bg: "bg-purple-50",
    text: "text-purple-700",
    label: "Exam",
  },
  PAYMENT: {
    icon: "💳",
    bg: "bg-green-50",
    text: "text-green-700",
    label: "Payment",
  },
  RESULT: {
    icon: "📊",
    bg: "bg-orange-50",
    text: "text-orange-700",
    label: "Result",
  },
  SYSTEM: {
    icon: "⚙️",
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: "System",
  },
  REMINDER: {
    icon: "🔔",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    label: "Reminder",
  },
};

const ALL_TABS = ["All", "Unread", "Application", "Exam", "Payment", "Result", "System", "Reminder"] as const;
type Tab = (typeof ALL_TABS)[number];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationListProps {
  initialNotifications: NotificationItem[];
  unreadCount: number;
}

export default function NotificationList({
  initialNotifications,
  unreadCount: initialUnreadCount,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [markingAll, setMarkingAll] = useState(false);

  // --------------------------------------------------------------------------
  // Filtering
  // --------------------------------------------------------------------------

  const filtered = notifications.filter((n) => {
    if (activeTab === "All") return true;
    if (activeTab === "Unread") return !n.isRead;
    // Map tab label to category
    const catLabel = CATEGORY_CONFIG[n.category]?.label;
    return catLabel === activeTab;
  });

  // --------------------------------------------------------------------------
  // Mark single as read
  // --------------------------------------------------------------------------

  async function markAsRead(id: string) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) return; // Silently fail — don't interrupt UX

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silently ignore network errors on click
    }
  }

  // --------------------------------------------------------------------------
  // Mark all as read
  // --------------------------------------------------------------------------

  async function markAllAsRead() {
    if (unreadCount === 0) return;

    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (!res.ok) {
        toast.error("Failed to mark all as read. Please try again.");
        return;
      }

      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: now }))
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Top bar: tabs + mark all */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1">
          {ALL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeTab === tab
                  ? "bg-[#1B4332] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab}
              {tab === "Unread" && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#1B4332]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mark all read */}
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || markingAll}
          onClick={markAllAsRead}
          className="shrink-0 text-xs"
        >
          {markingAll ? "Marking..." : "Mark all as read"}
        </Button>
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <EmptyNotifications activeTab={activeTab} />
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {filtered.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onRead={() => markAsRead(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification row
// ---------------------------------------------------------------------------

function NotificationRow({
  notification: n,
  onRead,
}: {
  notification: NotificationItem;
  onRead: () => void;
}) {
  const cfg = CATEGORY_CONFIG[n.category] ?? CATEGORY_CONFIG.SYSTEM;

  return (
    <button
      type="button"
      onClick={onRead}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors",
        n.isRead
          ? "bg-white hover:bg-gray-50"
          : "bg-blue-50/40 hover:bg-blue-50"
      )}
    >
      {/* Category icon */}
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base",
          cfg.bg
        )}
        aria-hidden="true"
      >
        {cfg.icon}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug",
              n.isRead ? "font-normal text-gray-800" : "font-semibold text-gray-900"
            )}
          >
            {n.title}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {timeAgo(n.createdAt)}
            </span>
            {!n.isRead && (
              <span
                className="h-2 w-2 rounded-full bg-blue-500 shrink-0"
                aria-label="Unread"
              />
            )}
          </div>
        </div>

        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.message}</p>

        <Badge
          className={cn(
            "mt-1.5 h-4 rounded-full px-1.5 text-[10px] font-medium",
            cfg.bg,
            cfg.text,
            "border-0"
          )}
        >
          {cfg.label}
        </Badge>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyNotifications({ activeTab }: { activeTab: Tab }) {
  const messages: Record<string, string> = {
    All: "You have no notifications yet. We'll let you know when something happens.",
    Unread: "You're all caught up! No unread notifications.",
  };

  const message =
    messages[activeTab] ??
    `No ${activeTab.toLowerCase()} notifications at the moment.`;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
        🔔
      </div>
      <h3 className="text-sm font-semibold text-gray-900">No notifications</h3>
      <p className="mt-1 max-w-xs text-xs text-gray-500">{message}</p>
    </div>
  );
}
