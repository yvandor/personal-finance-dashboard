import { describe, expect, it } from "vitest";
import { billOptimisticReducer } from "@/lib/recurringBills";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";

function makeBill(overrides: Partial<RecurringBillWithStatusDTO> = {}): RecurringBillWithStatusDTO {
  return {
    id: "b1",
    name: "Rent",
    amountCents: 150000,
    dueDay: 1,
    categoryId: null,
    categoryName: null,
    isActive: true,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isPaidThisMonth: false,
    status: "UPCOMING",
    dueDate: "2026-03-01",
    daysUntilDue: 10,
    ...overrides,
  };
}

describe("billOptimisticReducer", () => {
  it("appends a new bill on add", () => {
    const result = billOptimisticReducer([], { type: "add", bill: makeBill() });
    expect(result).toEqual([makeBill()]);
  });

  it("merges a patch into the matching bill on update, leaving others untouched", () => {
    const state = [makeBill({ id: "b1" }), makeBill({ id: "b2", name: "Internet" })];
    const result = billOptimisticReducer(state, { type: "update", id: "b1", patch: { name: "Renamed" } });
    expect(result.find((b) => b.id === "b1")?.name).toBe("Renamed");
    expect(result.find((b) => b.id === "b2")?.name).toBe("Internet");
  });

  it("an update for a nonexistent id is a no-op", () => {
    const state = [makeBill({ id: "b1" })];
    const result = billOptimisticReducer(state, { type: "update", id: "does-not-exist", patch: { name: "x" } });
    expect(result).toEqual(state);
  });

  it("can update isActive (archiving) via the same update action", () => {
    const state = [makeBill({ id: "b1", isActive: true })];
    const result = billOptimisticReducer(state, { type: "update", id: "b1", patch: { isActive: false } });
    expect(result[0].isActive).toBe(false);
  });
});
