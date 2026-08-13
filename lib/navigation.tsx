"use client";

// Shared between the desktop sidebar (rendered via SidebarNav below, from
// app/(dashboard)/layout.tsx, a Server Component), the mobile drawer
// (components/layout/MobileNav.tsx), and the mobile bottom bar
// (components/layout/BottomNav.tsx) so all three surfaces can never drift
// out of sync -- one list, one place a new route gets wired into
// navigation, one place its icon and active-route logic live.
//
// This module is "use client" (not a plain data file) for two reasons:
//  - useActiveNavHref below wraps next/navigation's usePathname, which only
//    works in Client Components.
//  - SidebarNav needs that same hook to highlight the current route, and
//    app/(dashboard)/layout.tsx must stay a Server Component (it renders
//    <SignOutButton /> -- a Server Component -- directly; see
//    MobileNav.tsx's signOutSlot comment for why a "use client" file can't
//    import that itself). SidebarNav lives here rather than in
//    MobileNav.tsx or BottomNav.tsx specifically to avoid a circular
//    import: BottomNav renders MobileNav internally (see BottomNav.tsx's
//    header comment), so neither of those two files can be the shared home
//    for something layout.tsx, MobileNav.tsx, AND BottomNav.tsx all need.
//    lib/navigation.tsx imports neither of them, so it's the one
//    non-circular common ancestor. (components/ui/CategoryBadge.tsx and
//    lib/icon-mark.tsx are the existing precedents for a presentational
//    component living outside components/ui or components/layout.)
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

type NavIconProps = { className?: string };
type NavIconComponent = (props: NavIconProps) => ReactElement;

// Every icon below follows components/ui/Modal.tsx's existing inline-SVG
// convention: a plain 24x24 `viewBox`, `stroke="currentColor"` so it
// inherits the surrounding text color (including the active-route accent),
// `fill="none"` except where a small solid dot reads better filled, and
// `aria-hidden` since the adjacent label already carries the meaning --
// this app has no icon library dependency and, per AGENTS.md's
// minimal-dependency-surface value, shouldn't gain one for a presentation
// refactor.
const ICON_SVG_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function DashboardIcon({ className }: NavIconProps) {
  return (
    <svg {...ICON_SVG_PROPS} className={className} aria-hidden="true">
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </svg>
  );
}

function TransactionsIcon({ className }: NavIconProps) {
  return (
    <svg {...ICON_SVG_PROPS} className={className} aria-hidden="true">
      <path d="M7 3v14m0 0-3-3m3 3 3-3M17 21V7m0 0-3 3m3-3 3 3" />
    </svg>
  );
}

function BudgetsIcon({ className }: NavIconProps) {
  return (
    <svg {...ICON_SVG_PROPS} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeLinejoin="round" />
      <path d="M12 4v8l6 3" />
    </svg>
  );
}

function BillsIcon({ className }: NavIconProps) {
  return (
    <svg {...ICON_SVG_PROPS} className={className} aria-hidden="true">
      <path d="M6 3h9l3 3v15H6z" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </svg>
  );
}

function IncomeIcon({ className }: NavIconProps) {
  return (
    <svg {...ICON_SVG_PROPS} className={className} aria-hidden="true">
      <path d="M12 20V6m0 0-5 5m5-5 5 5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function GoalsIcon({ className }: NavIconProps) {
  return (
    <svg {...ICON_SVG_PROPS} className={className} aria-hidden="true">
      <path d="M6 21V4" />
      <path d="M6 4h13l-3 4 3 4H6" strokeLinejoin="round" />
    </svg>
  );
}

function CategoriesIcon({ className }: NavIconProps) {
  return (
    <svg {...ICON_SVG_PROPS} className={className} aria-hidden="true">
      <path d="M11 3h7v7l-9 9-7-7 9-9z" strokeLinejoin="round" />
      <circle cx="15.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HistoryIcon({ className }: NavIconProps) {
  return (
    <svg {...ICON_SVG_PROPS} className={className} aria-hidden="true">
      <path d="M4 4v6h6" />
      <path d="M4.5 10A8 8 0 1 0 6 5" />
    </svg>
  );
}

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconComponent;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/transactions", label: "Transactions", icon: TransactionsIcon },
  { href: "/budgets", label: "Budgets", icon: BudgetsIcon },
  { href: "/bills", label: "Bills", icon: BillsIcon },
  { href: "/income", label: "Income", icon: IncomeIcon },
  { href: "/goals", label: "Goals", icon: GoalsIcon },
  { href: "/categories", label: "Categories", icon: CategoriesIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
];

// A route is "active" for itself and every path nested under it (e.g.
// /transactions/123 keeps Transactions highlighted), matching the check
// MobileNav.tsx already used before this hook existed.
export function useActiveNavHref(href: string): boolean {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The desktop sidebar's nav list. A Client Component so it can highlight
// the active route (see the module comment above for why this can't live
// directly in the Server Component app/(dashboard)/layout.tsx).
export function SidebarNav() {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => (
        <SidebarNavLink key={item.href} item={item} />
      ))}
    </nav>
  );
}

function SidebarNavLink({ item }: { item: NavItem }) {
  const active = useActiveNavHref(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      // --accent-subtle is intentionally low-contrast on its own (see
      // app/globals.css's ACCENT convention), so the active row always
      // pairs it with a text-accent color change and a font-weight bump.
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        active
          ? "bg-accent-subtle font-medium text-accent"
          : "font-medium text-muted hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      <Icon className="size-5 shrink-0" />
      {item.label}
    </Link>
  );
}
