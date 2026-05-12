import type { Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { LayoutDashboard, KanbanSquare, ShieldAlert, FileText, Settings } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProjectPulse AI",
  description: "Autonomous PMO copilot — risk scored, narrative drafted, decisions ready before standup.",
};

const nav = [
  { href: "/",         label: "Overview", icon: LayoutDashboard },
  { href: "/kanban",   label: "Kanban",   icon: KanbanSquare },
  { href: "/risks",    label: "Risks",    icon: ShieldAlert },
  { href: "/reports",  label: "Reports",  icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen">
          <SignedIn>
            <div className="flex min-h-screen">
              <aside className="w-60 shrink-0 border-r border-white/5 bg-[var(--panel)] p-4">
                <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
                  ProjectPulse
                </Link>
                <nav className="flex flex-col gap-1 text-sm">
                  {nav.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  ))}
                </nav>
                <div className="absolute bottom-4 left-4">
                  <UserButton afterSignOutUrl="/sign-in" />
                </div>
              </aside>
              <main className="flex-1 p-8">{children}</main>
            </div>
          </SignedIn>
          <SignedOut>{children}</SignedOut>
        </body>
      </html>
    </ClerkProvider>
  );
}
