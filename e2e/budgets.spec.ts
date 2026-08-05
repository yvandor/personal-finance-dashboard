import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

test.describe("Budgets critical path", () => {
  test.beforeEach(async ({ page }) => {
    resetE2EData();
    await page.goto("/budgets");
  });

  test("creates a budget, reflects added spending, then edits and deletes it", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();

    // Edit/delete buttons carry the category name in their accessible name
    // (see BudgetCard.tsx), which is unique on the page -- no need to scope
    // to a containing card element. Composite amounts ("$X of $Y") are
    // split across sibling <span>s in the DOM, so they're asserted via
    // `body`'s combined text content rather than a strict single-element
    // text locator.
    const body = page.locator("body");

    // Create
    await page.getByRole("button", { name: "Add budget", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "Add budget" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Category").selectOption({ label: "Groceries" });
    await createDialog.getByLabel("Monthly limit").fill("400.00");
    await createDialog.getByRole("button", { name: "Add budget" }).click();
    await expect(createDialog).not.toBeVisible();

    await expect(body).toContainText("$0.00 of $400.00");
    await expect(body).toContainText("$400.00 remaining");
    await expect(page.getByText("On track", { exact: true })).toBeVisible();

    // Add spending in that category via the transactions page.
    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const txDialog = page.getByRole("dialog", { name: "Add transaction" });
    await txDialog.getByLabel("Amount").fill("150.00");
    await txDialog.getByLabel("Category").selectOption({ label: "Groceries" });
    await txDialog.getByLabel("Description").fill("Big grocery run");
    await txDialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(txDialog).not.toBeVisible();

    // Back to budgets: usage updated.
    await page.getByRole("link", { name: "Budgets" }).click();
    await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();
    await expect(body).toContainText("$150.00 of $400.00");
    await expect(body).toContainText("$250.00 remaining");
    await expect(body).toContainText("38% used");

    // Edit the limit down, pushing it into "over budget".
    await page.getByRole("button", { name: "Edit budget for Groceries" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit budget" });
    await expect(editDialog).toBeVisible();
    const amountField = editDialog.getByLabel("Monthly limit");
    await amountField.fill("");
    await amountField.fill("100.00");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();

    await expect(body).toContainText("$150.00 of $100.00");
    // Exact + case-sensitive: BudgetCard's own "remaining" line separately
    // renders lowercase "over budget" text when negative, which a
    // case-insensitive substring match would also match.
    await expect(page.getByText("Over budget", { exact: true })).toBeVisible();

    // Delete
    await page.getByRole("button", { name: "Delete budget for Groceries" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Delete budget?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();
    await expect(confirmDialog).not.toBeVisible();

    await expect(page.getByText("No budgets set for this month yet")).toBeVisible();
  });
});
