"use client";

import { useState } from "react";
import AppSidebar from "./AppSidebar";
import Header from "./Header";
import type { UserRole } from "@prisma/client";
import type { StaffPermissions } from "@/lib/staffAccess";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
  orgName?: string;
  orgLogo?: string | null;
  unreadCount?: number;
  permissions?: StaffPermissions | null;
  branchName?: string | null;
}

export default function DashboardLayout({
  children,
  role,
  userName,
  userEmail,
  userAvatar,
  orgName,
  orgLogo,
  unreadCount = 0,
  permissions,
  branchName,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AppSidebar role={role} orgName={orgName} orgLogo={orgLogo} permissions={permissions} branchName={branchName} />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar}
          userRole={role}
          unreadCount={unreadCount}
          onMenuToggle={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
