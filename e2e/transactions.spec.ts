import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// Desktop Chrome's default viewport (see playwright.config.ts's project) is
// >= the app's md breakpoint (768px), so the desktop <table> is the visible
// surface and the mobile <div> card list is CSS-hidden -- both are always
// present in the DOM simultaneously (TransactionList renders both, see its
// own comment). Two things make text queries here genuinely ambiguous, not
// just verbose to write around: (1) a row's own delete-confirmation
// <dialog> is nested inside that row's <td> (native <dialog> isn't
// portaled out), so scoping to the table alone doesn't exclude it -- cell
// role queries do, since the dialog's text lives in a <p>, not a <td>; (2)
// summary-card totals are asserted via `body`'s aggregate text rather than
// a single-element locator, since e.g. Expenses and Net render identically
// whenever there's no income, which a strict single-match locator can't
// tolerate. A baseline income transaction is also seeded so Expenses and
// Net are never coincidentally equal to begin with.
test.describe("Transactions critical path", () => {
  let diningOutId: string;

  test.beforeEach(async ({ page }) => {
    const { categoryIds } = resetE2EData([
      { type: "INCOME", amountCents: 20000, date: "2026-01-01", description: "Baseline paycheck", categoryName: "Salary" },
      { type: "EXPENSE", amountCents: 2000, date: "2026-01-05", description: "Existing rent", categoryName: "Utilities" },
    ]);
    diningOutId = categoryIds["Dining Out"];
    await page.goto("/transactions");
  });

  test("adds, edits, and deletes an expense transaction, with totals updating throughout", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();

    const body = page.locator("body");
    const table = page.locator("table");

    // Baseline: income 200, expenses -20, net 180.
    await expect(body).toContainText("-$20.00");
    await expect(body).toContainText("$180.00");

    // Add
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const addDialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(addDialog).toBeVisible();
    await addDialog.getByLabel("Amount").fill("45.00");
    await addDialog.getByLabel("Category").selectOption({ label: "Groceries" });
    await addDialog.getByLabel("Description").fill("Weekly shop");
    await addDialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(addDialog).not.toBeVisible();

    // Appears in the (desktop) list
    await expect(table.getByRole("cell", { name: "Weekly shop", exact: true })).toBeVisible();
    await expect(table.getByText("-$45.00")).toBeVisible();

    // Totals: expenses -65, net 135.
    await expect(body).toContainText("-$65.00");
    await expect(body).toContainText("$135.00");

    // Edit
    await table.getByRole("row", { name: /Weekly shop/ }).getByRole("button", { name: "Edit Weekly shop" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit transaction" });
    await expect(editDialog).toBeVisible();
    const amountField = editDialog.getByLabel("Amount");
    await amountField.fill("");
    await amountField.fill("50.00");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();

    await expect(table.getByText("-$50.00")).toBeVisible();
    // Totals now reflect the edit: expenses -70, net 130.
    await expect(body).toContainText("-$70.00");
    await expect(body).toContainText("$130.00");

    // Delete
    await table.getByRole("row", { name: /Weekly shop/ }).getByRole("button", { name: "Delete Weekly shop" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Delete transaction?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();
    await expect(confirmDialog).not.toBeVisible();

    await expect(table.getByRole("cell", { name: "Weekly shop", exact: true })).not.toBeVisible();
    // Back to baseline only.
    await expect(body).toContainText("-$20.00");
    await expect(body).toContainText("$180.00");
  });

  test("preserves entered values and shows field-level errors on an invalid submission, then succeeds once corrected", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Amount").fill("not-a-number");
    await dialog.getByLabel("Category").selectOption({ label: "Dining Out" });
    await dialog.getByLabel("Description").fill("Dinner out");
    await dialog.getByRole("button", { name: "Add transaction" }).click();

    // Field-level validation appears, tied to the Amount field.
    const amountField = dialog.getByLabel("Amount");
    await expect(amountField).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText("Enter a valid amount, like 12.34.")).toBeVisible();

    // Entered values remain visible -- nothing was reset by the failed submission.
    await expect(amountField).toHaveValue("not-a-number");
    await expect(dialog.getByLabel("Description")).toHaveValue("Dinner out");
    await expect(dialog.getByLabel("Category")).toHaveValue(diningOutId);

    // Correct the input and submit successfully.
    await amountField.fill("");
    await amountField.fill("22.50");
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog).not.toBeVisible();

    const table = page.locator("table");
    await expect(table.getByRole("cell", { name: "Dinner out", exact: true })).toBeVisible();
    await expect(table.getByText("-$22.50")).toBeVisible();
  });
});
