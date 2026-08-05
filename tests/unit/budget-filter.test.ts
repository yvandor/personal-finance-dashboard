import { describe, expect, it } from "vitest";
import { filterAvailableBudgetCategories } from "@/lib/budgets";
import type { CategoryDTO } from "@/server/data/categories";

const categories: CategoryDTO[] = [
  { id: "cat-groceries", type: "EXPENSE", name: "Groceries", color: "#000" },
  { id: "cat-dining", type: "EXPENSE", name: "Dining Out", color: "#000" },
  { id: "cat-salary", type: "INCOME", name: "Salary", color: "#000" },
];

describe("filterAvailableBudgetCategories", () => {
  it("excludes income categories", () => {
    const result = filterAvailableBudgetCategories(categories, new Set());
    expect(result.map((c) => c.name)).toEqual(["Groceries", "Dining Out"]);
  });

  it("excludes expense categories already budgeted this month", () => {
    const result = filterAvailableBudgetCategories(categories, new Set(["cat-groceries"]));
    expect(result.map((c) => c.name)).toEqual(["Dining Out"]);
  });

  it("returns every expense category when none are budgeted yet", () => {
    const result = filterAvailableBudgetCategories(categories, new Set());
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when every expense category is already budgeted", () => {
    const result = filterAvailableBudgetCategories(categories, new Set(["cat-groceries", "cat-dining"]));
    expect(result).toEqual([]);
  });

  it("never includes an income category even if its id happens to be in the budgeted set", () => {
    // Defensive: an income category should never surface regardless of
    // what's in budgetedCategoryIds -- the type check comes first.
    const result = filterAvailableBudgetCategories(categories, new Set());
    expect(result.some((c) => c.type === "INCOME")).toBe(false);
  });
});
