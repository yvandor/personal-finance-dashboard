import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { createTransaction, updateTransaction } from "@/server/data/transactions";
import {
  createIncomeSource,
  updateIncomeSource,
  archiveIncomeSource,
  unarchiveIncomeSource,
  listIncomeSources,
  listIncomeSourcesForManagement,
  getIncomeVsExpected,
} from "@/server/data/incomeSources";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { currentMonthKey } from "@/lib/dates";
import {
  DEV_USER_ID,
  OTHER_USER_ID,
  createTestCategory,
  createTestIncomeSource,
  resetTestData,
} from "../setup";

// Same mocking approach as tests/integration/categories.test.ts and
// tests/integration/budgets.test.ts.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

const NONEXISTENT_ID = "clh3ans2z0000356ub9pu9q0m";

// getIncomeVsExpected is month-relative, so every date used here is
// computed from `new Date()` at test-run time rather than a hardcoded
// calendar date -- same reasoning as tests/integration/budgets.test.ts.
const thisMonth = currentMonthKey();
const lastMonth = currentMonthKey(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)));
const thisMonthDay = (day: string) => `${thisMonth}-${day}`;

describe("income sources DAL", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createIncomeSource", () => {
    it("creates an income source", async () => {
      const source = await createIncomeSource({ name: "Paycheck", amountCents: 250000, payDay: 15 });
      expect(source.name).toBe("Paycheck");
      expect(source.amountCents).toBe(250000);
      expect(source.payDay).toBe(15);
      expect(source.notes).toBeNull();
    });

    it("creates an income source with explicit notes", async () => {
      const source = await createIncomeSource({
        name: "Freelance",
        amountCents: 100000,
        payDay: 1,
        notes: "Variable client work",
      });
      expect(source.notes).toBe("Variable client work");
    });

    it("prevents a duplicate name for the same user", async () => {
      await createIncomeSource({ name: "Paycheck", amountCents: 250000, payDay: 15 });
      await expect(
        createIncomeSource({ name: "Paycheck", amountCents: 300000, payDay: 1 }),
      ).rejects.toThrow(ValidationError);
    });

    it("scopes the duplicate-name check to the current user", async () => {
      await createTestIncomeSource(OTHER_USER_ID, "Paycheck", 250000, 15);
      const created = await createIncomeSource({ name: "Paycheck", amountCents: 250000, payDay: 15 });
      expect(created.name).toBe("Paycheck");
    });

    it("rejects an unknown extra field (mass-assignment guard)", async () => {
      await expect(
        createIncomeSource({ name: "Paycheck", amountCents: 250000, payDay: 15, userId: "someone-else" }),
      ).rejects.toThrow();
    });

    it("rejects invalid input before writing anything to the database", async () => {
      const countBefore = await prisma.incomeSource.count();
      await expect(
        createIncomeSource({ name: "Paycheck", amountCents: -1, payDay: 15 }),
      ).rejects.toThrow();
      expect(await prisma.incomeSource.count()).toBe(countBefore);
    });
  });

  describe("updateIncomeSource", () => {
    it("renames an income source", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const updated = await updateIncomeSource(source.id, { name: "Main job" });
      expect(updated.name).toBe("Main job");
      expect(updated.amountCents).toBe(250000); // untouched
    });

    it("updates the amount and payDay", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const updated = await updateIncomeSource(source.id, { amountCents: 275000, payDay: 1 });
      expect(updated.amountCents).toBe(275000);
      expect(updated.payDay).toBe(1);
    });

    it("updates notes", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const updated = await updateIncomeSource(source.id, { notes: "Now biweekly" });
      expect(updated.notes).toBe("Now biweekly");
    });

    it("throws NotFoundError updating a nonexistent income source", async () => {
      await expect(updateIncomeSource(NONEXISTENT_ID, { name: "x" })).rejects.toThrow(NotFoundError);
    });

    it("cannot update another user's income source, and the row is unmodified", async () => {
      const theirs = await createTestIncomeSource(OTHER_USER_ID, "Theirs", 100000, 1);
      await expect(updateIncomeSource(theirs.id, { name: "Renamed" })).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.incomeSource.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.name).toBe("Theirs");
    });

    it("rejects renaming to a name already used by another of the user's income sources", async () => {
      await createTestIncomeSource(DEV_USER_ID, "Freelance", 100000, 1);
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      await expect(updateIncomeSource(source.id, { name: "Freelance" })).rejects.toThrow(ValidationError);
    });
  });

  describe("archiveIncomeSource / unarchiveIncomeSource", () => {
    it("archives an income source", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      await archiveIncomeSource(source.id);
      const row = await prisma.incomeSource.findUnique({ where: { id: source.id } });
      expect(row?.isActive).toBe(false);
    });

    it("removes an archived source from listIncomeSources({ isActive: true }) (the picker feed)", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      await archiveIncomeSource(source.id);
      const active = await listIncomeSources({ isActive: true });
      expect(active.find((s) => s.id === source.id)).toBeUndefined();
    });

    it("keeps an in-use source's transactions intact after archiving", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("15"),
        description: "March paycheck",
        categoryId: cat.id,
        incomeSourceId: source.id,
      });
      await archiveIncomeSource(source.id);
      const tx = await prisma.transaction.findFirst({ where: { incomeSourceId: source.id } });
      expect(tx).not.toBeNull();
    });

    it("unarchives an income source, restoring it to listIncomeSources({ isActive: true })", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      await archiveIncomeSource(source.id);
      await unarchiveIncomeSource(source.id);
      const active = await listIncomeSources({ isActive: true });
      expect(active.find((s) => s.id === source.id)).toBeDefined();
    });

    it("throws NotFoundError archiving a nonexistent income source", async () => {
      await expect(archiveIncomeSource(NONEXISTENT_ID)).rejects.toThrow(NotFoundError);
    });

    it("cannot archive another user's income source", async () => {
      const theirs = await createTestIncomeSource(OTHER_USER_ID, "Theirs", 100000, 1);
      await expect(archiveIncomeSource(theirs.id)).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.incomeSource.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.isActive).toBe(true);
    });
  });

  describe("listIncomeSources", () => {
    it("returns only active sources when isActive: true", async () => {
      const active = await createTestIncomeSource(DEV_USER_ID, "Active", 100000, 1);
      const archived = await createTestIncomeSource(DEV_USER_ID, "Archived", 100000, 1);
      await archiveIncomeSource(archived.id);

      const result = await listIncomeSources({ isActive: true });
      expect(result.map((s) => s.id)).toEqual([active.id]);
    });

    it("returns every source (active and archived) when no filter is given", async () => {
      const active = await createTestIncomeSource(DEV_USER_ID, "Active", 100000, 1);
      const archived = await createTestIncomeSource(DEV_USER_ID, "Archived", 100000, 1);
      await archiveIncomeSource(archived.id);

      const result = await listIncomeSources();
      expect(result.map((s) => s.id).sort()).toEqual([active.id, archived.id].sort());
    });

    it("never includes another user's sources", async () => {
      await createTestIncomeSource(OTHER_USER_ID, "Theirs", 100000, 1);
      const mine = await listIncomeSources();
      expect(mine.find((s) => s.name === "Theirs")).toBeUndefined();
    });
  });

  describe("listIncomeSourcesForManagement", () => {
    it("includes archived sources, unlike listIncomeSources({ isActive: true })", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      await archiveIncomeSource(source.id);
      const all = await listIncomeSourcesForManagement();
      expect(all.find((s) => s.id === source.id)?.isActive).toBe(false);
    });

    it("reports an accurate tagged-transaction count", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("15"),
        description: "Paycheck 1",
        categoryId: cat.id,
        incomeSourceId: source.id,
      });
      await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("30"),
        description: "Paycheck 2",
        categoryId: cat.id,
        incomeSourceId: source.id,
      });

      const all = await listIncomeSourcesForManagement();
      expect(all.find((s) => s.id === source.id)?.transactionCount).toBe(2);
    });

    it("never includes another user's sources", async () => {
      await createTestIncomeSource(OTHER_USER_ID, "Theirs", 100000, 1);
      const mine = await listIncomeSourcesForManagement();
      expect(mine.find((s) => s.name === "Theirs")).toBeUndefined();
    });
  });

  describe("getIncomeVsExpected", () => {
    it("defaults to the current month when none is given", async () => {
      await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const result = await getIncomeVsExpected();
      expect(result.month).toBe(thisMonth);
    });

    it("reports expectedCents from the source and actualCents of 0 with no matching transactions", async () => {
      await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const result = await getIncomeVsExpected({ month: thisMonth });
      expect(result.sources).toEqual([
        { id: expect.any(String), name: "Paycheck", expectedCents: 250000, actualCents: 0 },
      ]);
      expect(result.totalExpectedCents).toBe(250000);
      expect(result.totalActualCents).toBe(0);
      expect(result.unattributedCents).toBe(0);
    });

    it("sums INCOME transactions tagged to the source within the month into actualCents", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await createTransaction({
        type: "INCOME",
        amountCents: 125000,
        date: thisMonthDay("15"),
        description: "First half",
        categoryId: cat.id,
        incomeSourceId: source.id,
      });
      await createTransaction({
        type: "INCOME",
        amountCents: 125000,
        date: thisMonthDay("30"),
        description: "Second half",
        categoryId: cat.id,
        incomeSourceId: source.id,
      });

      const result = await getIncomeVsExpected({ month: thisMonth });
      expect(result.sources[0].actualCents).toBe(250000);
    });

    it("excludes transactions from outside the requested month", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: `${lastMonth}-15`,
        description: "Last month's paycheck",
        categoryId: cat.id,
        incomeSourceId: source.id,
      });

      const result = await getIncomeVsExpected({ month: thisMonth });
      expect(result.sources[0].actualCents).toBe(0);
    });

    it("excludes EXPENSE transactions even if somehow tagged to a source", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Refund");
      // The DAL's own assertUsableIncomeSource rejects this combination at
      // the createTransaction boundary -- this row is written directly via
      // Prisma to prove getIncomeVsExpected's own WHERE clause is the real,
      // defense-in-depth guard, not just the write-time check.
      await prisma.transaction.create({
        data: {
          userId: DEV_USER_ID,
          type: "EXPENSE",
          amountCents: 5000,
          date: new Date(thisMonthDay("10")),
          description: "Should never count",
          categoryId: cat.id,
          incomeSourceId: source.id,
        },
      });

      const result = await getIncomeVsExpected({ month: thisMonth });
      expect(result.sources[0].actualCents).toBe(0);
    });

    it("sums untagged INCOME transactions into unattributedCents, not any source", async () => {
      await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Gift");
      await createTransaction({
        type: "INCOME",
        amountCents: 5000,
        date: thisMonthDay("10"),
        description: "Birthday gift",
        categoryId: cat.id,
      });

      const result = await getIncomeVsExpected({ month: thisMonth });
      expect(result.unattributedCents).toBe(5000);
      expect(result.sources[0].actualCents).toBe(0);
    });

    it("excludes archived sources entirely", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      await archiveIncomeSource(source.id);

      const result = await getIncomeVsExpected({ month: thisMonth });
      expect(result.sources).toEqual([]);
      expect(result.totalExpectedCents).toBe(0);
    });

    it("computes totalActualCents as every source's actual plus unattributed", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const giftCat = await createTestCategory(DEV_USER_ID, "INCOME", "Gift");
      await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("15"),
        description: "Paycheck",
        categoryId: incomeCat.id,
        incomeSourceId: source.id,
      });
      await createTransaction({
        type: "INCOME",
        amountCents: 5000,
        date: thisMonthDay("10"),
        description: "Gift",
        categoryId: giftCat.id,
      });

      const result = await getIncomeVsExpected({ month: thisMonth });
      expect(result.totalActualCents).toBe(255000);
    });

    it("never includes another user's sources or transactions", async () => {
      const otherSource = await createTestIncomeSource(OTHER_USER_ID, "Theirs", 100000, 1);
      const otherCat = await createTestCategory(OTHER_USER_ID, "INCOME", "Theirs");
      actAs(OTHER_USER_ID);
      await createTransaction({
        type: "INCOME",
        amountCents: 100000,
        date: thisMonthDay("15"),
        description: "Their paycheck",
        categoryId: otherCat.id,
        incomeSourceId: otherSource.id,
      });

      actAs(DEV_USER_ID);
      const result = await getIncomeVsExpected({ month: thisMonth });
      expect(result.sources).toEqual([]);
      expect(result.unattributedCents).toBe(0);
    });
  });
});

describe("transactions DAL income source linking", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createTransaction", () => {
    it("links an income transaction to an income source", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const tx = await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("15"),
        description: "March paycheck",
        categoryId: cat.id,
        incomeSourceId: source.id,
      });
      expect(tx.incomeSourceId).toBe(source.id);
    });

    it("leaves incomeSourceId null when omitted", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const tx = await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("15"),
        description: "March paycheck",
        categoryId: cat.id,
      });
      expect(tx.incomeSourceId).toBeNull();
    });

    it("rejects a nonexistent incomeSourceId", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await expect(
        createTransaction({
          type: "INCOME",
          amountCents: 250000,
          date: thisMonthDay("15"),
          description: "March paycheck",
          categoryId: cat.id,
          incomeSourceId: NONEXISTENT_ID,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects an incomeSourceId belonging to another user", async () => {
      const otherSource = await createTestIncomeSource(OTHER_USER_ID, "Theirs", 100000, 1);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await expect(
        createTransaction({
          type: "INCOME",
          amountCents: 250000,
          date: thisMonthDay("15"),
          description: "Cross-link attempt",
          categoryId: cat.id,
          incomeSourceId: otherSource.id,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects linking an income source to an EXPENSE transaction", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await expect(
        createTransaction({
          type: "EXPENSE",
          amountCents: 1000,
          date: thisMonthDay("15"),
          description: "Mismatched type",
          categoryId: cat.id,
          incomeSourceId: source.id,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("updateTransaction", () => {
    it("sets an incomeSourceId on an existing income transaction", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const tx = await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("15"),
        description: "March paycheck",
        categoryId: cat.id,
      });
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const updated = await updateTransaction(tx.id, { incomeSourceId: source.id });
      expect(updated.incomeSourceId).toBe(source.id);
    });

    it("clears an existing incomeSourceId when explicitly set to null", async () => {
      const source = await createTestIncomeSource(DEV_USER_ID, "Paycheck", 250000, 15);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const tx = await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("15"),
        description: "March paycheck",
        categoryId: cat.id,
        incomeSourceId: source.id,
      });
      const updated = await updateTransaction(tx.id, { incomeSourceId: null });
      expect(updated.incomeSourceId).toBeNull();
    });

    it("rejects updating to an incomeSourceId belonging to another user", async () => {
      const otherSource = await createTestIncomeSource(OTHER_USER_ID, "Theirs", 100000, 1);
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const tx = await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: thisMonthDay("15"),
        description: "March paycheck",
        categoryId: cat.id,
      });
      await expect(updateTransaction(tx.id, { incomeSourceId: otherSource.id })).rejects.toThrow(NotFoundError);
    });
  });
});
