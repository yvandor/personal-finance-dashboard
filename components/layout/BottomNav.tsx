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
        // Fixed, deliberate 64px (h-16) content height -- reported to the
        // integrating lead so ToastProvider's mobile bottom offset can
        // clear it. pb-[calc(...)] combines the home-indicator safe-area
        // inset with the bar's normal 0.5rem bottom padding in one
        // declaration, same reasoning as the mobile header's
        // pt-[calc(...)] in app/(dashboard)/layout.tsx -- see
        // app/globals.css's comment on why a bare .pb-safe utility can't
        // just be stacked on top of a separate padding declaration.
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-surface pb-[calc(var(--safe-area-bottom)+0.5rem)] md:hidden"
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
