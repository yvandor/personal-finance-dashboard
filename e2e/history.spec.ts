import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// "Current month" is relative to the real wall clock, so every date here is
// computed from `new Date()` at run time rather than hardcoded, matching
// the same reasoning already used in e2e/dashboard.spec.ts.
const now = new Date();
const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
// "Last 3 months" (see lib/dates.ts's lastNMonths) covers [now-2, now-1,
// now] -- 4 months back is the nearest round number guaranteed to fall
// outside that window while still landing inside "last 12 months".
const fourMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4, 15));
const fourMonthsAgoKey = `${fourMonthsAgo.getUTCFullYear()}-${String(fourMonthsAgo.getUTCMonth() + 1).padStart(2, "0")}`;

// e2e/fixtures.ts's resetE2EData only seeds transactions/categories (no
// budgets or recurring bills yet -- see e2e/reset-data.ts), so this spec
// only exercises the income/expense/net columns and the months-back
// range-selector end to end; budgeted/spent/bills columns are covered at
// the DAL level in tests/integration/history.test.ts instead.
test.describe("History", () => {
  test.beforeEach(async ({ page }) => {
    resetE2EData([
      { type: "INCOME", amountCents: 500000, date: `${thisMonth}-05`, description: "This month's paycheck", categoryName: "Salary" },
      { type: "EXPENSE", amountCents: 20000, date: `${thisMonth}-06`, description: "This month's groceries", categoryName: "Groceries" },
      // Outside "last 3 months" but inside "last 12 months" -- gives the
      // months-back selector below a real, verifiable difference to check for.
      { type: "INCOME", amountCents: 90000, date: `${fourMonthsAgoKey}-10`, description: "Older paycheck", categoryName: "Salary" },
    ]);
    await page.goto("/history");
  });

  test("renders month rows with income/expenses/net and drills down into transactions", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();

    const table = page.getByRole("table");
    await expect(table).toContainText("$5,000.00"); // this month's income
    await expect(table).toContainText("-$200.00"); // this month's expenses (shown as an outflow)
    await expect(table).toContainText("$4,800.00"); // net

    // The income figure links through to the transactions page filtered to
    // that month's date range.
    const incomeLink = table.getByRole("link", { name: /5,000\.00/ });
    await expect(incomeLink).toHaveAttribute("href", new RegExp(`/transactions\\?dateFrom=${thisMonth}-01`));
    await incomeLink.click();
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    // Both the desktop table row and the mobile card list (and each row's
    // mounted-but-hidden delete-confirm dialog, which interpolates the
    // description into its own text) are all present in the DOM at once --
    // same ambiguity class documented in e2e/categories.spec.ts and
    // e2e/goals.spec.ts. Scope to the table cell specifically.
    await expect(page.getByRole("cell", { name: "This month's paycheck", exact: true })).toBeVisible();
  });

  test("changing the months-back selector widens the range shown", async ({ page }) => {
    // Switch to 3 months first to establish the four-months-ago paycheck is
    // excluded, then to 12 months to confirm it reappears -- a real,
    // verifiable difference either way.
    await page.getByLabel("Show").selectOption({ label: "Last 3 months" });
    await expect(page).toHaveURL(/monthsBack=3/);
    await expect(page.getByRole("table")).not.toContainText("$900.00");

    await page.getByLabel("Show").selectOption({ label: "Last 12 months" });
    await expect(page).toHaveURL(/monthsBack=12/);
    await expect(page.getByRole("table")).toContainText("$900.00");
  });

  test("shows a zero budgeted/spent and bills total when none are set up", async ({ page }) => {
    const table = page.getByRole("table");
    await expect(table).toContainText("$0.00");
    await expect(table).toContainText("0 of 0");
  });
});
