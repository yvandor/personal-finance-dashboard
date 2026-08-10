import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "@/components/layout/MobileNav";

// Navigation is the external boundary here, same reasoning as
// tests/unit/components/PeriodSelector.test.tsx.
vi.mock("next/navigation", () => ({
  usePathname: () => "/budgets",
}));

describe("MobileNav", () => {
  it("opens the drawer and lists every nav item, marking the active route", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));

    const nav = screen.getByRole("navigation");
    for (const label of ["Dashboard", "Transactions", "Budgets", "Bills", "Income", "Goals", "Categories", "History"]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible();
    }
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Budgets");
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const dialog = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(dialog).toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Close navigation menu" }));
    // jsdom's <dialog> has no UA stylesheet driving visibility off the
    // `open` attribute the way a real browser does (see tests/setup-dom.ts's
    // polyfill comment), so the closed-state assertion checks the attribute
    // the polyfill actually toggles, not toBeVisible().
    expect(dialog).not.toHaveAttribute("open");
  });
});
