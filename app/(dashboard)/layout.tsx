import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { BottomNav } from "@/components/layout/BottomNav";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SidebarNav } from "@/lib/navigation";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
          <div className="px-5 py-5">
            <span className="text-lg font-semibold">Finance</span>
          </div>
          <SidebarNav />
          <div className="border-t border-border px-3 py-3">
            <SignOutButton className="text-muted" />
          </div>
        </aside>

        {/* Mobile top bar: brand only, no hamburger. Route navigation on
            mobile now lives entirely in BottomNav (rendered below, fixed to
            the viewport bottom) -- its "More" item opens the same drawer
            MobileNav provides for the remaining routes plus sign-out, so
            this header doesn't also need a trigger for it; two different
            controls opening the identical drawer would read as redundant.
            pt-[calc(...)] combines the iPhone notch/Dynamic Island
            safe-area inset with the header's normal 12px top padding in
            one declaration -- see app/globals.css's comment on why a
            separate pt-safe utility can't just be stacked on top of py-3.
            Only nonzero in standalone (Add to Home Screen) mode; an
            ordinary Safari tab already reserves this space itself. */}
        <header className="flex items-center border-b border-border bg-surface px-4 pb-3 pt-[calc(var(--safe-area-top)+0.75rem)] md:hidden">
          <span className="text-lg font-semibold">Finance</span>
        </header>

        {/* pb-[calc(...)] keeps content clear of BottomNav's fixed 64px
            (h-16) bar plus its own safe-area-aware bottom padding (see
            BottomNav.tsx) so nothing renders underneath it on mobile. */}
        <main className="min-w-0 flex-1 pb-[calc(4.5rem+var(--safe-area-bottom))] md:pb-0">{children}</main>

        <BottomNav signOutSlot={<SignOutButton className="text-muted" />} />
      </div>
    </ToastProvider>
  );
}
