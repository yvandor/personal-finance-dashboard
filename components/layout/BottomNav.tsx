"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { NAV_ITEMS, useActiveNavHref, type NavItem } from "@/lib/navigation";
import { MobileNav } from "@/components/layout/MobileNav";

// Exactly the 4 primary routes surfaced directly in the bar, kept in
// NAV_ITEMS' own order (Dashboard, Transactions, Budgets, Goals) rather than
// duplicating each item's label/icon here -- a future edit to an item in
// lib/navigation.tsx can't drift between this bar and the sidebar/drawer.
const PRIMARY_HREFS = new Set(["/dashboard", "/transactions", "/budgets", "/goals"]);

interface BottomNavProps {
  // Rendered output, not a component reference -- same reasoning as
  // MobileNav.tsx's own signOutSlot prop: SignOutButton is a Server
  // Component guarded by server/auth.ts's "server-only", so this "use
  // client" module can't import and instantiate it itself. Forwarded
  // straight through to the MobileNav instance this component owns below.
  signOutSlot?: ReactNode;
}

// Hybrid mobile bottom bar: 4 primary routes plus a "More" item that must
// open the SAME drawer MobileNav already provides for the remaining 4
// routes (Bills, Income, Categories, History) plus sign-out -- not a second,
// duplicate drawer. BottomNav is the one place that owns the drawer's open
// state and renders the single MobileNav instance (passing hideTrigger so
// MobileNav doesn't also render its own hamburger button); the mobile top
// header in app/(dashboard)/layout.tsx no longer renders a MobileNav
// trigger at all, so there is exactly one control that opens this drawer.
export function BottomNav({ signOutSlot }: BottomNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const primaryItems = NAV_ITEMS.filter((item) => PRIMARY_HREFS.has(item.href));

  return (
    <>
      <nav
        aria-label="Primary"
        // Fixed, deliberate 4rem (64px) *content* height for the tab row --
        // reported to the integrating lead so ToastProvider's mobile bottom
        // offset and app/(dashboard)/layout.tsx's <main> bottom padding can
        // both clear this bar.
        //
        // The height has to be a calc rather than a plain h-16: Tailwind's
        // preflight sets `box-sizing: border-box` on everything, so h-16
        // would make 4rem the bar's TOTAL height and the pb-[calc(...)]
        // below would eat into the tab row from inside it rather than add
        // to it. With a nonzero home-indicator inset (34px on a notched
        // iPhone in standalone mode, which is exactly where this bar
        // matters) that left the tabs ~21px tall -- far under the 44px
        // minimum touch target, and 0.5rem shorter than that even with a
        // zero inset. Spelling out content + inset + padding keeps the tab
        // row a real 4rem on every device and makes the bar's total height
        // exactly the 4.5rem + inset both consumers above assume.
        //
        // pb-[calc(...)] combines the home-indicator safe-area inset with
        // the bar's normal 0.5rem bottom padding in one declaration, same
        // reasoning as the mobile header's pt-[calc(...)] in
        // app/(dashboard)/layout.tsx -- see app/globals.css's comment on why
        // a bare .pb-safe utility can't just be stacked on top of a separate
        // padding declaration.
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+0.5rem+var(--safe-area-bottom))] items-stretch border-t border-border bg-surface pb-[calc(var(--safe-area-bottom)+0.5rem)] md:hidden"
      >
        {primaryItems.map((item) => (
          <BottomNavLink key={item.href} item={item} />
        ))}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted hover:text-foreground"
        >
          <MoreIcon className="size-5" />
          <span className="text-xs font-medium">More</span>
        </button>
      </nav>

      <MobileNav open={drawerOpen} onOpenChange={setDrawerOpen} hideTrigger signOutSlot={signOutSlot} />
    </>
  );
}

function BottomNavLink({ item }: { item: NavItem }) {
  const active = useActiveNavHref(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      // A compact tab never gets --accent-subtle's background treatment
      // (there's no padded row to fill) -- text-accent plus a font-weight
      // bump is the pairing app/globals.css's ACCENT convention calls for
      // whenever accent-subtle's background isn't in play.
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
        active ? "font-semibold text-accent" : "font-medium text-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}

function MoreIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className} aria-hidden="true">
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}
