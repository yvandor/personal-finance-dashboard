import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// "Current month" is relative to the real wall clock, so every date here is
// computed from `new Date()` at run time rather than hardcoded, matching
// the same reasoning already used in tests/integration/dashboard.test.ts.
const now = new Date();
const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const twoMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 15));
const twoMonthsAgoKey = `${twoMonthsAgo.getUTCFullYear()}-${String(twoMonthsAgo.getUTCMonth() + 1).padStart(2, "0")}`;

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    resetE2EData([
      { type: "INCOME", amountCents: 500000, date: `${thisMonth}-05`, description: "This month's paycheck", categoryName: "Salary" },
      { type: "EXPENSE", amountCents: 10000, date: `${thisMonth}-06`, description: "This month's groceries", categoryName: "Groceries" },
      // Outside "current month" but inside "last 3 months" -- gives the
      // period switch below a real, verifiable difference to check for.
      { type: "INCOME", amountCents: 90000, date: `${twoMonthsAgoKey}-10`, description: "Older paycheck", categoryName: "Salary" },
    ]);
    await page.goto("/dashboard");
  });

  test("renders summary cards, charts with accessible companions, and updates when the period changes", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Summary cards (current month: 500000 income, 10000 expense)
    const body = page.locator("body");
    await expect(page.getByText("Total income")).toBeVisible();
    await expect(page.getByText("Total expenses")).toBeVisible();
    await expect(page.getByText("Net cash flow")).toBeVisible();
    await expect(page.getByText("Savings rate")).toBeVisible();
    await expect(body).toContainText("$5,000.00");
    await expect(body).toContainText("$100.00");

    // Charts render with their accessible text companions (not just an SVG).
    await expect(page.getByRole("heading", { name: "Income vs. expenses by month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expenses by category" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible(); // TrendChart's month/income/expenses table
    // exact: true -- RecentTransactions' "This month's groceries" description
    // and its "Groceries · <date>" category label both also contain
    // "Groceries" as a substring.
    await expect(page.getByText("Groceries", { exact: true })).toBeVisible(); // CategoryBreakdownChart's legend list

    // Change the reporting period -- the older, two-months-ago paycheck
    // should now be included, changing the income total.
    await page.getByLabel("Period").selectOption({ label: "Last 3 months" });
    await expect(page).toHaveURL(/period=last-3-months/);
    // 500000 (this month) + 90000 (two months ago) = 590000 = $5,900.00
    await expect(body).toContainText("$5,900.00");
  });
});
