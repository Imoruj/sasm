import { create } from "zustand";

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  createdAt: Date;
  data?: Record<string, unknown>;
}

interface NotificationStore {
  notifications: InAppNotification[];
  unreadCount: number;
  setNotifications: (notifications: InAppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (notification: InAppNotification) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.isRead).length }),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    })),
}));
