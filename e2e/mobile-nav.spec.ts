import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";
import { NAV_ITEMS } from "../lib/navigation";

// Before this drawer existed, the mobile header was a static "Finance"
// label with no way to reach any route except by typing a URL -- see the
// v1.3 mobile-usability review. This spec is the regression guard for that
// specific gap, exercised at a real Playwright-controlled phone viewport
// (unlike a desktop-only manual check, which can't catch a CSS breakpoint
// bug at all). Since v1.7 the drawer's trigger is BottomNav's "More" tab,
// not a header hamburger button -- see the comment on the first test below.
test.describe("Mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    resetE2EData();
    await page.goto("/dashboard");
  });

  // Since v1.7, mobile navigation is a hybrid bottom bar (BottomNav, 4
  // primary routes) plus a "More" tab that opens this same drawer for the
  // remaining routes -- there is no more hamburger button (see the header
  // comment in app/(dashboard)/layout.tsx for why the mobile header no
  // longer renders a trigger at all).
  test("the desktop sidebar is hidden and BottomNav provides primary links plus a drawer for the rest", async ({
    page,
  }) => {
    // Desktop sidebar nav is CSS-hidden below the md breakpoint (see
    // app/(dashboard)/layout.tsx) -- BottomNav's own "Primary" landmark
    // (components/layout/BottomNav.tsx) is the only navigation landmark
    // present at this width until the drawer is opened.
    await expect(page.getByRole("navigation")).toHaveCount(1);
    const bottomNav = page.getByRole("navigation", { name: "Primary" });
    await expect(bottomNav).toBeVisible();

    // BottomNav's 4 primary tabs, same set as its own PRIMARY_HREFS.
    const primaryHrefs = new Set(["/dashboard", "/transactions", "/budgets", "/goals"]);
    for (const item of NAV_ITEMS.filter((i) => primaryHrefs.has(i.href))) {
      await expect(bottomNav.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }

    await page.getByRole("button", { name: "More" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(drawer).toBeVisible();

    for (const item of NAV_ITEMS) {
      await expect(drawer.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  test("clicking a link navigates and closes the drawer", async ({ page }) => {
    await page.getByRole("button", { name: "More" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await drawer.getByRole("link", { name: "Bills" }).click();

    await expect(page).toHaveURL(/\/bills$/);
    await expect(page.getByRole("heading", { name: "Bills", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Navigation menu" })).not.toBeVisible();
  });

  test("Escape closes the drawer", async ({ page }) => {
    await page.getByRole("button", { name: "More" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(drawer).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("every nav route loads without error at a phone-sized viewport", async ({ page }) => {
    for (const item of NAV_ITEMS) {
      await page.goto(item.href);
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
