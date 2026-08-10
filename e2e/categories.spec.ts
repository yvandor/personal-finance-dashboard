import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

test.describe("Categories critical path", () => {
  test.beforeEach(async ({ page }) => {
    resetE2EData();
    await page.goto("/categories");
  });

  test("creates a category, renames it, archives it, then restores it", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();
    // .first(): every row's not-yet-open dialogs (edit form, archive confirm)
    // also carry the category name in their DOM text, same ambiguity
    // BudgetList.test.tsx's "outsideDialog" helper works around -- here we
    // only care that the seeded fixture category rendered somewhere.
    await expect(page.getByText("Groceries").first()).toBeVisible();

    // Create
    await page.getByRole("button", { name: "Add category", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "Add category" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Name").fill("Hobbies");
    await createDialog.getByLabel("Expense").check();
    await createDialog.getByRole("button", { name: "Add category" }).click();
    await expect(createDialog).not.toBeVisible();

    await expect(page.getByText("Hobbies").first()).toBeVisible();
    await expect(page.getByText("Not currently in use").first()).toBeVisible();

    // Rename
    await page.getByRole("button", { name: "Edit Hobbies" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit category" });
    await expect(editDialog).toBeVisible();
    const nameField = editDialog.getByLabel("Name");
    await nameField.fill("");
    await nameField.fill("Hobbies & Crafts");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();

    await expect(page.getByText("Hobbies & Crafts").first()).toBeVisible();

    // Archive
    await page.getByRole("button", { name: "Archive Hobbies & Crafts" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Archive category?" });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText("isn't currently in use");
    await confirmDialog.getByRole("button", { name: "Archive" }).click();
    await expect(confirmDialog).not.toBeVisible();

    await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Hobbies & Crafts" })).not.toBeVisible();

    // The archived category no longer appears in the transaction form's category picker.
    await page.getByRole("link", { name: "Transactions" }).click();
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const txDialog = page.getByRole("dialog", { name: "Add transaction" });
    const categoryOptions = await txDialog.getByLabel("Category").locator("option").allTextContents();
    expect(categoryOptions).not.toContain("Hobbies & Crafts");
    await txDialog.getByRole("button", { name: "Close" }).click();

    // Restore
    await page.getByRole("link", { name: "Categories" }).click();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("heading", { name: "Archived" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Hobbies & Crafts" })).toBeVisible();
  });
});
