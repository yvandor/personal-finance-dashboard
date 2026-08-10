// Shared between the desktop sidebar (app/(dashboard)/layout.tsx, a Server
// Component) and the mobile nav drawer (components/layout/MobileNav.tsx, a
// Client Component) so the two surfaces can never drift out of sync -- one
// list, one place a new route gets wired into navigation.
export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Budgets" },
  { href: "/bills", label: "Bills" },
  { href: "/income", label: "Income" },
  { href: "/goals", label: "Goals" },
  { href: "/categories", label: "Categories" },
  { href: "/history", label: "History" },
];
