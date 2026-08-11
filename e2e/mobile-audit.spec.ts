import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// Regression guard for the v1.4 mobile-UX audit slice: the specific,
// concrete bugs iOS Safari is prone to that a desktop-viewport run of the
// rest of the e2e suite can't catch --
//   1. a focused form field computing to a sub-16px font, which makes
//      Safari auto-zoom the viewport on focus (see TransactionForm.tsx and
//      every other Form.tsx -- all already use `text-base` on every real
//      input/select/textarea, this is the regression guard for that);
//   2. horizontal overflow at a real iPhone width;
//   3. a modal `<dialog>` failing to block scroll on the page behind it.
// Real iPhone 14/15-class viewport (393x852), matching e2e/dialogs.spec.ts
// and e2e/mobile-nav.spec.ts's `test.use({ viewport: {...} })` convention
// (those use 390x844, the previous-generation iPhone 12/13 size -- this
// suite intentionally targets the newer, current-generation size).
test.use({ viewport: { width: 393, height: 852 } });

test.describe("Mobile audit: iOS input-zoom guard", () => {
  test.beforeEach(() => {
    resetE2EData();
  });

  // Playwright's own real Chromium doesn't reproduce Safari's zoom-on-focus
  // behavior itself, so this can't assert "the viewport didn't zoom" -- it
  // asserts the actual precondition that behavior depends on
  // (getComputedStyle's fontSize), which is browser-engine-independent and
  // exactly what Safari's own zoom heuristic reads.
  test("every field in the Add transaction dialog computes to >=16px", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();

    const fields = [
      dialog.getByLabel("Amount"),
      dialog.getByLabel("Date"),
      dialog.getByLabel("Category"),
      dialog.getByLabel("Description"),
      dialog.getByLabel("Notes (optional)"),
    ];

    for (const field of fields) {
      const fontSize = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });

  test("every field in the Add budget dialog computes to >=16px", async ({ page }) => {
    await page.goto("/budgets");
    await page.getByRole("button", { name: "Add budget", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add budget" });
    await expect(dialog).toBeVisible();

    const fields = [dialog.getByLabel("Category"), dialog.getByLabel("Monthly limit")];

    for (const field of fields) {
      const fontSize = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });

  test("every field in the Add income source dialog computes to >=16px", async ({ page }) => {
    await page.goto("/income");
    await page.getByRole("button", { name: "Add income source", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add income source" });
    await expect(dialog).toBeVisible();

    const fields = [dialog.getByLabel("Name"), dialog.getByLabel("Expected amount"), dialog.getByLabel("Pay day")];

    for (const field of fields) {
      const fontSize = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });
});

test.describe("Mobile audit: no horizontal overflow", () => {
  test.beforeEach(() => {
    resetE2EData([
      { type: "EXPENSE", amountCents: 1234, date: "2024-01-05", description: "Coffee shop", categoryName: "Groceries" },
      { type: "EXPENSE", amountCents: 5678, date: "2024-01-10", description: "Electric bill", categoryName: "Utilities" },
    ]);
  });

  // documentElement.scrollWidth > clientWidth is the standard signal for
  // "something wider than the viewport forced a horizontal scrollbar" -- on
  // an actual iPhone that means the user can drag the whole page sideways
  // and lose content off the edge, not just a cosmetic scrollbar.
  for (const path of ["/transactions", "/budgets", "/income", "/bills"]) {
    test(`${path} has no horizontal overflow at 393px wide`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }
});

test.describe("Mobile audit: dialog scroll-lock", () => {
  test.beforeEach(() => {
    // Enough rows that the mobile card list is actually taller than the
    // viewport -- the scroll-lock claim is only meaningful to test against
    // a page that would otherwise be scrollable.
    resetE2EData(
      Array.from({ length: 25 }, (_, i) => ({
        type: "EXPENSE" as const,
        amountCents: 1000 + i,
        date: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
        description: `Transaction ${i}`,
        categoryName: "Groceries",
      })),
    );
  });

  test("opening a dialog blocks scrolling the page behind it; closing restores it", async ({ page }) => {
    await page.goto("/transactions");

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(scrollHeight).toBeGreaterThan(viewportHeight); // precondition: the page is actually scrollable

    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();

    const scrollYBeforeAttempt = await page.evaluate(() => window.scrollY);
    expect(scrollYBeforeAttempt).toBe(0);

    // A wheel scroll gesture over the (dialog-covered) viewport -- native
    // <dialog> renders its ::backdrop in the top layer, which captures
    // pointer/wheel input intended for whatever is underneath, so this
    // should have no effect on the page's own scroll position while the
    // dialog is open.
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150);

    const scrollYWhileOpen = await page.evaluate(() => window.scrollY);
    expect(scrollYWhileOpen).toBe(0);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    // Scrolling works normally again once the dialog is closed.
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150);
    const scrollYAfterClose = await page.evaluate(() => window.scrollY);
    expect(scrollYAfterClose).toBeGreaterThan(0);
  });
});
