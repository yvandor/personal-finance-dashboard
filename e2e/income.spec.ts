import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// The dashboard sidebar (app/(dashboard)/layout.tsx) doesn't have an
// "Income" nav link yet -- out of this slice's owned files -- so every
// spec here navigates directly via page.goto("/income") rather than
// clicking a nav item, same as any other direct-URL Playwright flow.
//
// e2e/reset-data.ts's fixed category set has no income sources of its own
// (income sources are a user-managed entity, like categories, not fixture
// data), so every test here creates its own via the UI rather than relying
// on a seed.
function currentMonthDateString(day: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test.describe("Income sources critical path", () => {
  test.beforeEach(async ({ page }) => {
    resetE2EData();
    await page.goto("/income");
  });

  test("creates an income source, renames it, tags a transaction to it, then archives and restores it", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Income Sources" })).toBeVisible();
    await expect(page.getByText("No income sources yet")).toBeVisible();

    // Create
    await page.getByRole("button", { name: "Add income source", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "Add income source" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Name").fill("Paycheck");
    await createDialog.getByLabel("Expected amount").fill("2500.00");
    const payDayField = createDialog.getByLabel("Pay day");
    await payDayField.fill("");
    await payDayField.fill("15");
    await createDialog.getByRole("button", { name: "Add income source" }).click();
    await expect(createDialog).not.toBeVisible();

    await expect(page.getByText("Paycheck").first()).toBeVisible();
    await expect(page.getByText("Not currently in use")).toBeVisible();
    // The month summary shows the expected amount with nothing received yet.
    await expect(page.locator("body")).toContainText("$0.00 of $2,500.00");
    await expect(page.getByText("Awaiting", { exact: true })).toBeVisible();

    // Rename
    await page.getByRole("button", { name: "Edit Paycheck" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit income source" });
    await expect(editDialog).toBeVisible();
    const nameField = editDialog.getByLabel("Name");
    await nameField.fill("");
    await nameField.fill("Main Job");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();

    await expect(page.getByText("Main Job").first()).toBeVisible();
    await expect(page.getByText("Paycheck")).not.toBeVisible();

    // Tag an income transaction to it from the transactions page.
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const txDialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(txDialog).toBeVisible();
    await txDialog.getByLabel("Expense").check();
    await txDialog.getByLabel("Income").check();
    await txDialog.getByLabel("Amount").fill("2500.00");
    await txDialog.getByLabel("Category").selectOption({ label: "Salary" });
    const sourceField = txDialog.getByLabel("Source");
    await expect(sourceField).toBeVisible();
    await sourceField.selectOption({ label: "Main Job" });
    await txDialog.getByLabel("Date").fill(currentMonthDateString("05"));
    await txDialog.getByLabel("Description").fill("March paycheck");
    await txDialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(txDialog).not.toBeVisible();

    // Back on /income, the source's actual now matches what was received.
    await page.goto("/income");
    await expect(page.locator("body")).toContainText("$2,500.00 of $2,500.00");
    await expect(page.getByText("Fully received", { exact: true })).toBeVisible();

    // Archive
    await page.getByRole("button", { name: "Archive Main Job" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Archive income source?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Archive" }).click();
    await expect(confirmDialog).not.toBeVisible();

    await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Main Job" })).not.toBeVisible();

    // The archived source no longer appears in the transaction form's Source picker.
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const newTxDialog = page.getByRole("dialog", { name: "Add transaction" });
    await newTxDialog.getByLabel("Income").check();
    const sourceOptions = await newTxDialog.getByLabel("Source").locator("option").allTextContents();
    expect(sourceOptions).not.toContain("Main Job");
    await newTxDialog.getByRole("button", { name: "Close" }).click();

    // Restore
    await page.goto("/income");
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("heading", { name: "Archived" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Main Job" })).toBeVisible();
  });

  test("keeps an income transaction unattributed and shown separately when no source is chosen", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await dialog.getByLabel("Income").check();
    await dialog.getByLabel("Amount").fill("50.00");
    await dialog.getByLabel("Category").selectOption({ label: "Salary" });
    // Source is left at its default "No source" option.
    await dialog.getByLabel("Date").fill(currentMonthDateString("05"));
    await dialog.getByLabel("Description").fill("Gift");
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog).not.toBeVisible();

    await page.goto("/income");
    await expect(page.getByText(/wasn't tagged to any income source/)).toBeVisible();
    await expect(page.locator("body")).toContainText("$50.00");
  });
});
