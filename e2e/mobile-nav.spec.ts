import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";
import { NAV_ITEMS } from "../lib/navigation";

// Before this drawer existed, the mobile header was a static "Finance"
// label with no way to reach any route except by typing a URL -- see the
// v1.3 mobile-usability review. This spec is the regression guard for that
// specific gap, exercised at a real Playwright-controlled phone viewport
// (unlike a desktop-only manual check, which can't catch a CSS breakpoint
// bug at all).
test.describe("Mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    resetE2EData();
    await page.goto("/dashboard");
  });

  test("the desktop sidebar is hidden and the hamburger opens a drawer listing every route", async ({ page }) => {
    // Desktop sidebar nav is CSS-hidden below the md breakpoint (see
    // app/(dashboard)/layout.tsx) -- only the drawer's nav should be
    // reachable at this width until it's opened.
    await expect(page.getByRole("navigation")).toHaveCount(0);

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(drawer).toBeVisible();

    for (const item of NAV_ITEMS) {
      await expect(drawer.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  test("clicking a link navigates and closes the drawer", async ({ page }) => {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await drawer.getByRole("link", { name: "Bills" }).click();

    await expect(page).toHaveURL(/\/bills$/);
    await expect(page.getByRole("heading", { name: "Bills", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Navigation menu" })).not.toBeVisible();
  });

  test("Escape closes the drawer", async ({ page }) => {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
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
