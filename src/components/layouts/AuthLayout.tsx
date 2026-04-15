"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

interface Branding {
  name: string | null;
  logoUrl: string | null;
}

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {
  const [branding, setBranding] = useState<Branding>({ name: null, logoUrl: null });

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBranding(json.data);
      })
      .catch(() => {});
  }, []);

  const displayName = branding.name ?? "SAMS";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo + School Name */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2.5 mb-4">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={displayName}
                className="h-10 w-10 rounded-xl object-contain border border-gray-100 bg-white p-0.5"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1B4332]">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
            )}
            <span className="text-xl font-bold text-gray-900">{displayName}</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-2 text-center text-sm text-gray-500">
              {description.replace("SAMS", displayName)}
            </p>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} {displayName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
