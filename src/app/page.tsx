import Link from "next/link";
import { GraduationCap, CheckCircle, ArrowRight, Users, FileText, BarChart3, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: FileText,
    title: "Digital Applications",
    description: "Apply online in minutes. Auto-save drafts so you never lose progress.",
  },
  {
    icon: Users,
    title: "Multi-Branch Support",
    description: "Manage admissions across all your school branches from a single dashboard.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Track applications, conversion rates, and revenue with live dashboards.",
  },
  {
    icon: Shield,
    title: "Secure & Compliant",
    description: "NDPR compliant with AES-256 encryption. Your data is always protected.",
  },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Create Account", description: "Register as a parent or guardian in under 2 minutes." },
  { step: "2", title: "Fill Application", description: "Complete the digital form with your child's details." },
  { step: "3", title: "Submit & Pay", description: "Pay the application fee securely via Paystack or Flutterwave." },
  { step: "4", title: "Track Progress", description: "Monitor your application status in real time." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex h-16 items-center justify-between border-b border-gray-100 px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B4332]">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">SAMS</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]" asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center lg:py-28">
        <div className="mb-4 inline-flex items-center rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-[#1B4332]">
          Built for Nigerian secondary schools
        </div>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 lg:text-6xl">
          Modern Admissions,{" "}
          <span className="text-[#1B4332]">Simplified</span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-500">
          SAMS replaces paper-based admission processes with a fast, transparent digital platform.
          Process applications 10x faster and give applicants a world-class experience.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="bg-[#1B4332] hover:bg-[#2D6A4F]" asChild>
            <Link href="/register">
              Apply Now <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/contact">Request a Demo</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">Everything you need</h2>
          <p className="mb-12 text-center text-gray-500">One platform for applicants, admins, and school directors.</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl border border-gray-200 bg-white p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1B4332]/10">
                    <Icon className="h-5 w-5 text-[#1B4332]" />
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900">{feature.title}</h3>
                  <p className="text-sm text-gray-500">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">How it works</h2>
          <p className="mb-12 text-center text-gray-500">Start your application in 4 easy steps.</p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B4332] text-xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1B4332] px-6 py-16 text-center text-white">
        <h2 className="mb-3 text-3xl font-bold">Ready to modernise your admissions?</h2>
        <p className="mb-8 text-[#52B788]">Join hundreds of Nigerian schools already using SAMS.</p>
        <Button size="lg" className="bg-white text-[#1B4332] hover:bg-gray-100" asChild>
          <Link href="/register">Get Started Free</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
        <p>&copy; {new Date().getFullYear()} SAMS. Built for Nigerian schools. NDPR Compliant.</p>
      </footer>
    </div>
  );
}
