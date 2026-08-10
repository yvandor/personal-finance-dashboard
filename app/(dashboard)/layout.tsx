import Link from "next/link";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { MobileNav } from "@/components/layout/MobileNav";
import { NAV_ITEMS } from "@/lib/navigation";

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

        {/* Mobile top bar: hamburger opens the full nav in a slide-over drawer.
            pt-[calc(...)] combines the iPhone notch/Dynamic Island safe-area
            inset with the header's normal 12px top padding in one
            declaration -- see app/globals.css's comment on why a separate
            pt-safe utility can't just be stacked on top of py-3. Only
            nonzero in standalone (Add to Home Screen) mode; an ordinary
            Safari tab already reserves this space itself. */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 pb-3 pt-[calc(var(--safe-area-top)+0.75rem)] md:hidden">
          <span className="text-lg font-semibold">Finance</span>
          <MobileNav />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
