import Link from "next/link";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/ToastProvider";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Budgets" },
  { href: "/goals", label: "Goals" },
  { href: "/categories", label: "Categories" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
          <div className="px-5 py-5">
            <span className="text-lg font-semibold">Finance</span>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile top bar -- a bottom nav isn't worth it yet for a single route */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <span className="text-lg font-semibold">Finance</span>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
