import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// Uses the real "Add transaction" dialog as the subject rather than a
// synthetic harness -- this is exactly the kind of native-browser behavior
// (showModal()'s focus handling, real CSS layout/centering) that the
// component-test layer's jsdom polyfill (see tests/setup-dom.ts) could only
// approximate; a real browser is what actually proves it.
test.describe("Dialog behavior (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    resetE2EData();
    await page.goto("/transactions");
  });

  test("is centered in the viewport at desktop width", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Add transaction", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();

    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    if (!viewport || !box) throw new Error("Expected a viewport size and dialog bounding box");

    const dialogCenterX = box.x + box.width / 2;
    const viewportCenterX = viewport.width / 2;
    // A small tolerance for scrollbar/border-width rounding, not a loose
    // approximation of "centered" -- this is the direct regression check
    // for the P0 dialog-centering fix (Tailwind Preflight's margin reset
    // overriding the native <dialog> UA stylesheet's centering).
    expect(Math.abs(dialogCenterX - viewportCenterX)).toBeLessThan(10);
  });

  test("moves focus into the dialog when opened, and gives it an accessible name", async ({ page }) => {
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();

    const focusInsideDialog = await page.evaluate(() => {
      const dialogEl = document.querySelector("dialog[open]");
      return dialogEl != null && dialogEl.contains(document.activeElement);
    });
    expect(focusInsideDialog).toBe(true);
  });

  test("Escape closes the dialog and returns focus to the trigger", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Add transaction", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("the Close button also closes the dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("delete confirmation requires an explicit confirm action", async ({ page }) => {
    // Seed a real row via the UI's own add flow so there's something to delete.
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const addDialog = page.getByRole("dialog", { name: "Add transaction" });
    await addDialog.getByLabel("Amount").fill("15.00");
    await addDialog.getByLabel("Category").selectOption({ index: 1 });
    await addDialog.getByLabel("Description").fill("To delete");
    await addDialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(addDialog).not.toBeVisible();

    const table = page.locator("table");
    await table.getByRole("button", { name: "Delete To delete" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Delete transaction?" });
    await expect(confirmDialog).toBeVisible();

    // Scoped via the "cell" role, not plain text -- the row's own
    // delete-confirmation <dialog> is nested inside the table (native
    // <dialog> isn't portaled out), and its description text mentions "To
    // delete" too; a cell role only matches the actual <td>, not the
    // dialog's <p>.
    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(table.getByRole("cell", { name: "To delete", exact: true })).toBeVisible(); // never deleted

    await table.getByRole("button", { name: "Delete To delete" }).click();
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(table.getByRole("cell", { name: "To delete", exact: true })).not.toBeVisible();
  });
});

test.describe("Dialog behavior (mobile viewport)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the add-transaction dialog is usable on a phone-sized viewport", async ({ page }) => {
    resetE2EData();
    await page.goto("/transactions");

    // The mobile card list is the visible surface at this width; the
    // desktop table is CSS-hidden (see TransactionList.tsx).
    await expect(page.locator("table")).not.toBeVisible();

    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Amount")).toBeVisible();
    await expect(dialog.getByLabel("Description")).toBeVisible();

    await dialog.getByLabel("Amount").fill("12.00");
    await dialog.getByLabel("Category").selectOption({ index: 1 });
    await dialog.getByLabel("Description").fill("Mobile add");
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog).not.toBeVisible();

    // Now visible in the mobile card list. Scoped to <p> with an anchored
    // exact match: the table's (hidden) <td> and this same card's own
    // delete-confirmation dialog description both also contain "Mobile
    // add" as text -- the tag restriction excludes the <td>, and the
    // anchored match excludes the dialog's longer sentence.
    await expect(page.locator("p", { hasText: /^Mobile add$/ })).toBeVisible();
  });
});
