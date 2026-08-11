import { test, expect } from "@playwright/test";

test.describe("Health check", () => {
  test("GET /api/health returns ok and is never cached", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers()["cache-control"]).toContain("no-store");
  });
});
