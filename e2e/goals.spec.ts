import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

test.describe("Savings Goals critical path", () => {
  test.beforeEach(async ({ page }) => {
    resetE2EData();
    await page.goto("/goals");
  });

  test("creates a goal, contributes toward it, reaches it, then edits and deletes it", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Savings Goals" })).toBeVisible();
    await expect(page.getByText("No savings goals yet")).toBeVisible();

    // Composite amounts ("$X of $Y") are split across sibling <span>s in the
    // DOM (see GoalCard.tsx), so they're asserted via body's combined text
    // content rather than a strict single-element text locator -- same
    // pattern as e2e/budgets.spec.ts.
    const body = page.locator("body");

    // Create
    await page.getByRole("button", { name: "Add goal", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "Add goal" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Name").fill("New Laptop");
    await createDialog.getByLabel("Target amount").fill("400.00");
    await createDialog.getByRole("button", { name: "Add goal" }).click();
    await expect(createDialog).not.toBeVisible();

    await expect(page.getByText("New Laptop").first()).toBeVisible();
    await expect(body).toContainText("$0.00 of $400.00");

    // Contribute (partial)
    await page.getByRole("button", { name: "Add contribution to New Laptop" }).click();
    const contributeDialog = page.getByRole("dialog", { name: "Add contribution" });
    await expect(contributeDialog).toBeVisible();
    await contributeDialog.getByLabel("Amount").fill("150.00");
    await contributeDialog.getByRole("button", { name: "Add contribution" }).click();
    await expect(contributeDialog).not.toBeVisible();

    await expect(body).toContainText("$150.00 of $400.00");

    // History reflects the contribution.
    await page.getByRole("button", { name: "History (1)" }).click();
    await expect(body).toContainText("$150.00");

    // Contribute the rest, crossing the target.
    await page.getByRole("button", { name: "Add contribution to New Laptop" }).click();
    const secondContributeDialog = page.getByRole("dialog", { name: "Add contribution" });
    await secondContributeDialog.getByLabel("Amount").fill("250.00");
    await secondContributeDialog.getByRole("button", { name: "Add contribution" }).click();
    await expect(secondContributeDialog).not.toBeVisible();

    // Reached: moves into the collapsed Completed section.
    await expect(page.getByRole("button", { name: /Completed \(1\)/ })).toBeVisible();
    await page.getByRole("button", { name: /Completed \(1\)/ }).click();
    await expect(page.getByText("Goal reached")).toBeVisible();
    // An achieved goal no longer offers a Contribute button.
    await expect(page.getByRole("button", { name: "Add contribution to New Laptop" })).not.toBeVisible();

    // Edit (rename) -- still available on an achieved goal.
    await page.getByRole("button", { name: "Edit New Laptop" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit goal" });
    await expect(editDialog).toBeVisible();
    const nameField = editDialog.getByLabel("Name");
    await nameField.fill("");
    await nameField.fill("New Gaming Laptop");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();
    await expect(page.getByText("New Gaming Laptop").first()).toBeVisible();

    // Delete
    await page.getByRole("button", { name: "Delete goal New Gaming Laptop" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Delete goal?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();
    await expect(confirmDialog).not.toBeVisible();

    await expect(page.getByText("No savings goals yet")).toBeVisible();
  });
});
