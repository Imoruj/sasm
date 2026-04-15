"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  GraduationCap,
  BarChart3,
  Users,
  Building2,
  Settings,
  BookOpen,
  Bell,
  UserCircle,
  ClipboardList,
  Calendar,
  MessageSquare,
  TrendingUp,
  Layers,
  Trophy,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import {
  canAccessStaffFeature,
  hasExplicitStaffPermissions,
  type PermissionKey,
  type StaffPermissions,
} from "@/lib/staffAccess";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  feature?: PermissionKey | null;
}

const APPLICANT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Applications", href: "/dashboard/applications", icon: FileText },
  { label: "Exams", href: "/dashboard/exams", icon: GraduationCap },
  { label: "Results", href: "/dashboard/results", icon: BarChart3 },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Profile", href: "/dashboard/profile", icon: UserCircle },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard",      href: "/admin",                icon: LayoutDashboard },
  { label: "Applications",   href: "/admin/applications",   icon: ClipboardList, feature: "applications" },
  { label: "Form Builder",   href: "/admin/forms",          icon: Layers, feature: "forms" },
  { label: "Exams",          href: "/admin/exams",          icon: Calendar, feature: "exams" },
  { label: "Results",        href: "/admin/results",        icon: Trophy, feature: "exams" },
  { label: "Admissions",     href: "/admin/admissions",     icon: UserCheck, feature: "applications" },
  { label: "Communications", href: "/admin/communications", icon: MessageSquare, feature: "communications" },
  { label: "Reports",        href: "/admin/reports",        icon: BarChart3, feature: "reports" },
  { label: "Settings",       href: "/admin/settings",       icon: Settings, feature: "settings" },
];

const SUPER_ADMIN_NAV: NavItem[] = [
  { label: "Dashboard",       href: "/super-admin",                   icon: LayoutDashboard },
  { label: "Branches",        href: "/super-admin/branches",          icon: Building2 },
  { label: "Staff",           href: "/super-admin/staff",             icon: Users },
  { label: "Applications",    href: "/super-admin/applications",      icon: ClipboardList },
  { label: "Form Templates",  href: "/super-admin/forms",             icon: Layers },
  { label: "Admission Cycles",href: "/super-admin/cycles",            icon: BookOpen },
  { label: "Analytics",       href: "/super-admin/analytics",         icon: TrendingUp },
  { label: "Organisation",    href: "/super-admin/organizations",     icon: Settings },
  { label: "App Settings",    href: "/super-admin/settings",          icon: MessageSquare },
];

function getNavItems(role: UserRole, permissions?: StaffPermissions | null): NavItem[] {
  if (role === "SUPER_ADMIN") return SUPER_ADMIN_NAV;
  if (role === "SCHOOL_ADMIN") {
    return ADMIN_NAV.filter((item) => {
      if (!item.feature) return true; // Dashboard, profile — always visible
      return canAccessStaffFeature(role, permissions, item.feature);
    });
  }
  return APPLICANT_NAV;
}

interface AppSidebarProps {
  role: UserRole;
  permissions?: StaffPermissions | null;
  orgName?: string;
  orgLogo?: string | null;
  branchName?: string | null;
}

export default function AppSidebar({ role, permissions, orgName, orgLogo, branchName }: AppSidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role, permissions);

  return (
    <aside className="flex h-full w-[280px] flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex min-h-16 items-center gap-3 border-b border-gray-200 px-6 py-3">
        {orgLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={orgLogo} alt={orgName} className="h-8 w-8 rounded-lg object-contain p-0.5" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B4332]">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-gray-900 wrap-break-word whitespace-normal">
            {orgName ?? "SAMS"}
          </p>
          <p className="text-xs text-gray-500 capitalize leading-4">
            {role === "SUPER_ADMIN"
              ? "Super Admin"
              : role === "SCHOOL_ADMIN"
              ? branchName ?? "Admin"
              : "Applicant Portal"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && item.href !== "/super-admin" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#1B4332] text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
