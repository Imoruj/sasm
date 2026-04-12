import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/components/providers/QueryProvider";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: {
    default: "SAMS — School Admission Management System",
    template: "%s | SAMS",
  },
  description: "Streamlined admission management for Nigerian secondary schools",
  icons: {
    icon: "/api/favicon",
    shortcut: "/api/favicon",
    apple: "/api/favicon",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased" suppressHydrationWarning>
        <SessionProvider>
          <QueryProvider>{children}</QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
