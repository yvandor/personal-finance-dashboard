import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

test.describe("Recurring Bills critical path", () => {
  test.beforeEach(async ({ page }) => {
    resetE2EData();
    await page.goto("/bills");
  });

  test("creates a bill, marks it paid (logging a transaction), then archives and restores it", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Bills", exact: true })).toBeVisible();
    await expect(page.getByText("No bills yet")).toBeVisible();

    // Create -- with a category, so the "log a transaction" option on
    // markBillPaid is available.
    await page.getByRole("button", { name: "Add bill", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "Add bill" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Name").fill("Internet");
    await createDialog.getByLabel("Amount").fill("59.99");
    await createDialog.getByLabel("Due day of month").selectOption("15");
    await createDialog.getByLabel("Category (optional)").selectOption({ label: "Utilities" });
    await createDialog.getByRole("button", { name: "Add bill" }).click();
    await expect(createDialog).not.toBeVisible();

    await expect(page.getByText("Internet").first()).toBeVisible();
    await expect(page.getByText("-$59.99").first()).toBeVisible();

    // Rename
    await page.getByRole("button", { name: "Edit Internet" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit bill" });
    await expect(editDialog).toBeVisible();
    const nameField = editDialog.getByLabel("Name");
    await nameField.fill("");
    await nameField.fill("Home Internet");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();
    await expect(page.getByText("Home Internet").first()).toBeVisible();

    // Mark paid, logging a transaction for it.
    await page.getByRole("button", { name: "Mark Home Internet paid" }).click();
    const paidDialog = page.getByRole("dialog", { name: "Mark bill paid" });
    await expect(paidDialog).toBeVisible();
    await expect(paidDialog.getByLabel("Log an expense transaction for this payment")).toBeChecked();
    await paidDialog.getByRole("button", { name: "Mark paid" }).click();
    await expect(paidDialog).not.toBeVisible();

    // Status flips to Paid and the Mark paid trigger disappears for this month.
    await expect(page.getByText("Paid").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Home Internet paid" })).not.toBeVisible();

    // The logged transaction is real, atomic, and visible on the Transactions page.
    await page.getByRole("link", { name: "Transactions" }).click();
    const table = page.locator("table");
    await expect(table.getByRole("cell", { name: "Home Internet", exact: true })).toBeVisible();
    await expect(table.getByText("-$59.99")).toBeVisible();

    // Archive -- direct navigation, not a sidebar click: app/(dashboard)/layout.tsx
    // has no "Bills" nav entry yet (out of this slice's owned files; wired
    // in during the mobile-nav integration pass).
    await page.goto("/bills");
    await page.getByRole("button", { name: "Archive Home Internet" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Archive bill?" });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText("payment history is kept");
    await confirmDialog.getByRole("button", { name: "Archive" }).click();
    await expect(confirmDialog).not.toBeVisible();

    await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Home Internet" })).not.toBeVisible();

    // Restore
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("heading", { name: "Archived" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Home Internet" })).toBeVisible();
  });

  test("marks a categoryless bill paid without logging a transaction", async ({ page }) => {
    await page.getByRole("button", { name: "Add bill", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "Add bill" });
    await createDialog.getByLabel("Name").fill("Streaming");
    await createDialog.getByLabel("Amount").fill("12.99");
    await createDialog.getByRole("button", { name: "Add bill" }).click();
    await expect(createDialog).not.toBeVisible();

    await page.getByRole("button", { name: "Mark Streaming paid" }).click();
    const paidDialog = page.getByRole("dialog", { name: "Mark bill paid" });
    await expect(paidDialog).toBeVisible();
    // No category was set -- the checkbox is disabled and off, and the
    // dialog explains why.
    await expect(paidDialog.getByLabel("Log an expense transaction for this payment")).toBeDisabled();
    await expect(paidDialog).toContainText("Add a category to this bill");
    await paidDialog.getByRole("button", { name: "Mark paid" }).click();
    await expect(paidDialog).not.toBeVisible();

    await expect(page.getByText("Paid").first()).toBeVisible();

    // No transaction was created for it. Wait for the Transactions page's
    // own heading before asserting absence -- without a sync barrier here,
    // a bare getByText can still catch the outgoing /bills page's own
    // "Streaming" bill row mid-navigation (a real, observed flake, not
    // hypothetical).
    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    await expect(page.getByText("Streaming")).not.toBeVisible();
  });
});
