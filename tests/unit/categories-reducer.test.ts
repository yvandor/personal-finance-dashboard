import { describe, expect, it } from "vitest";
import { categoryOptimisticReducer } from "@/lib/categories";
import type { CategoryManagementDTO } from "@/server/data/categories";

function makeCategory(overrides: Partial<CategoryManagementDTO> = {}): CategoryManagementDTO {
  return {
    id: "c1",
    type: "EXPENSE",
    name: "Groceries",
    color: "#64748b",
    isArchived: false,
    isSystem: false,
    transactionCount: 0,
    ...overrides,
  };
}

describe("categoryOptimisticReducer", () => {
  it("appends a new category on add", () => {
    const result = categoryOptimisticReducer([], { type: "add", category: makeCategory() });
    expect(result).toEqual([makeCategory()]);
  });

  it("merges a patch into the matching category on update, leaving others untouched", () => {
    const state = [makeCategory({ id: "c1" }), makeCategory({ id: "c2", name: "Dining" })];
    const result = categoryOptimisticReducer(state, { type: "update", id: "c1", patch: { name: "Renamed" } });
    expect(result.find((c) => c.id === "c1")?.name).toBe("Renamed");
    expect(result.find((c) => c.id === "c2")?.name).toBe("Dining");
  });

  it("an update for a nonexistent id is a no-op", () => {
    const state = [makeCategory({ id: "c1" })];
    const result = categoryOptimisticReducer(state, { type: "update", id: "does-not-exist", patch: { name: "x" } });
    expect(result).toEqual(state);
  });
});
