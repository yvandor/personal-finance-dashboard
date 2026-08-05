import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { getCurrentUserCurrency } from "@/server/data/users";
import { DEV_USER_ID, OTHER_USER_ID, resetTestData } from "../setup";

// Same mocking approach as tests/integration/transactions.test.ts --
// requireUserId() is the only source of the acting user, so isolation is
// exercised by swapping what it resolves to, not by passing a userId
// parameter (which doesn't exist on this function's signature).
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

describe("getCurrentUserCurrency", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("defaults to USD for a freshly-seeded user", async () => {
    expect(await getCurrentUserCurrency()).toBe("USD");
  });

  it("returns the acting user's stored currency, not another user's", async () => {
    await prisma.user.update({ where: { id: DEV_USER_ID }, data: { currency: "EUR" } });
    await prisma.user.update({ where: { id: OTHER_USER_ID }, data: { currency: "GBP" } });

    actAs(DEV_USER_ID);
    expect(await getCurrentUserCurrency()).toBe("EUR");

    actAs(OTHER_USER_ID);
    expect(await getCurrentUserCurrency()).toBe("GBP");
  });

  it("falls back to USD rather than throwing when the user row is missing", async () => {
    actAs("nonexistent-user-id");
    expect(await getCurrentUserCurrency()).toBe("USD");
  });
});
