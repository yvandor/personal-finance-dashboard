import { describe, expect, it } from "vitest";
import { transactionOptimisticReducer } from "@/lib/transactions";
import type { TransactionDTO } from "@/server/data/transactions";

function makeTransaction(overrides: Partial<TransactionDTO> = {}): TransactionDTO {
  return {
    id: "t1",
    userId: "u1",
    type: "EXPENSE",
    amountCents: 1000,
    date: "2026-03-10",
    description: "Coffee",
    notes: null,
    categoryId: "cat1",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("transactionOptimisticReducer", () => {
  it("inserts a new transaction sorted by date desc, matching listTransactions' own order", () => {
    const state = [makeTransaction({ id: "t1", date: "2026-03-10" }), makeTransaction({ id: "t2", date: "2026-03-05" })];
    const result = transactionOptimisticReducer(state, {
      type: "add",
      transaction: makeTransaction({ id: "t3", date: "2026-03-15" }),
    });
    expect(result.map((t) => t.id)).toEqual(["t3", "t1", "t2"]);
  });

  it("inserts an older-dated transaction in the correct position, not just at the top", () => {
    const state = [makeTransaction({ id: "t1", date: "2026-03-10" }), makeTransaction({ id: "t2", date: "2026-03-05" })];
    const result = transactionOptimisticReducer(state, {
      type: "add",
      transaction: makeTransaction({ id: "t3", date: "2026-03-07" }),
    });
    expect(result.map((t) => t.id)).toEqual(["t1", "t3", "t2"]);
  });

  it("breaks a same-date tie by id descending", () => {
    const state = [makeTransaction({ id: "b", date: "2026-03-10" })];
    const result = transactionOptimisticReducer(state, {
      type: "add",
      transaction: makeTransaction({ id: "a", date: "2026-03-10" }),
    });
    expect(result.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("merges a patch into the matching transaction on update, leaving others untouched", () => {
    const state = [makeTransaction({ id: "t1" }), makeTransaction({ id: "t2", description: "Other" })];
    const result = transactionOptimisticReducer(state, {
      type: "update",
      id: "t1",
      patch: { description: "Renamed" },
    });
    expect(result.find((t) => t.id === "t1")?.description).toBe("Renamed");
    expect(result.find((t) => t.id === "t2")?.description).toBe("Other");
  });

  it("removes the matching transaction on remove, leaving others untouched", () => {
    const state = [makeTransaction({ id: "t1" }), makeTransaction({ id: "t2" })];
    const result = transactionOptimisticReducer(state, { type: "remove", id: "t1" });
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });
});
