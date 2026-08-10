import { describe, expect, it } from "vitest";
import { budgetCreateSchema, budgetUpdateSchema, budgetFilterSchema, copyBudgetsSchema } from "@/lib/schemas/budget";

const validCreateInput = {
  categoryId: "clh3ans2z0000356ub9pu9q0m",
  month: "2026-03",
  amountCents: 30000,
};

describe("budgetCreateSchema", () => {
  it("accepts a valid budget", () => {
    const result = budgetCreateSchema.parse(validCreateInput);
    expect(result.amountCents).toBe(30000);
    expect(result.month).toBe("2026-03");
  });

  it("accepts a zero amount (a legitimate 'track but don't allocate' budget)", () => {
    const result = budgetCreateSchema.parse({ ...validCreateInput, amountCents: 0 });
    expect(result.amountCents).toBe(0);
  });

  it("rejects a negative amount", () => {
    expect(() => budgetCreateSchema.parse({ ...validCreateInput, amountCents: -1 })).toThrow();
  });

  it("rejects a non-integer amount", () => {
    expect(() => budgetCreateSchema.parse({ ...validCreateInput, amountCents: 12.5 })).toThrow();
  });

  it("rejects a malformed month", () => {
    expect(() => budgetCreateSchema.parse({ ...validCreateInput, month: "March 2026" })).toThrow();
    expect(() => budgetCreateSchema.parse({ ...validCreateInput, month: "2026-3" })).toThrow();
  });

  it("rejects a non-cuid categoryId", () => {
    expect(() => budgetCreateSchema.parse({ ...validCreateInput, categoryId: "not-an-id" })).toThrow();
  });

  it("rejects a missing categoryId", () => {
    const withoutCategory: Partial<typeof validCreateInput> = { ...validCreateInput };
    delete withoutCategory.categoryId;
    expect(() => budgetCreateSchema.parse(withoutCategory)).toThrow();
  });

  it("accepts optional notes within the length limit and rejects over it", () => {
    expect(budgetCreateSchema.parse({ ...validCreateInput, notes: "Holiday bump" }).notes).toBe(
      "Holiday bump",
    );
    expect(() => budgetCreateSchema.parse({ ...validCreateInput, notes: "x".repeat(501) })).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() => budgetCreateSchema.parse({ ...validCreateInput, userId: "someone-else" })).toThrow();
  });
});

describe("budgetUpdateSchema", () => {
  it("accepts an empty object (no-op update)", () => {
    expect(budgetUpdateSchema.parse({})).toEqual({});
  });

  it("accepts a partial update of just the amount", () => {
    expect(budgetUpdateSchema.parse({ amountCents: 500 })).toEqual({ amountCents: 500 });
  });

  it("still validates the fields that are provided", () => {
    expect(() => budgetUpdateSchema.parse({ amountCents: -1 })).toThrow();
  });

  it("rejects categoryId and month -- not editable on an existing budget", () => {
    expect(() => budgetUpdateSchema.parse({ categoryId: "clh3ans2z0000356ub9pu9q0m" })).toThrow();
    expect(() => budgetUpdateSchema.parse({ month: "2026-04" })).toThrow();
  });
});

describe("budgetFilterSchema", () => {
  it("makes month optional (the DAL resolves the default itself)", () => {
    expect(budgetFilterSchema.parse({})).toEqual({});
  });

  it("accepts a valid month filter", () => {
    expect(budgetFilterSchema.parse({ month: "2026-03" })).toEqual({ month: "2026-03" });
  });

  it("rejects a malformed month filter", () => {
    expect(() => budgetFilterSchema.parse({ month: "2026" })).toThrow();
  });
});

describe("copyBudgetsSchema", () => {
  it("accepts valid from/to months", () => {
    expect(copyBudgetsSchema.parse({ fromMonth: "2026-02", toMonth: "2026-03" })).toEqual({
      fromMonth: "2026-02",
      toMonth: "2026-03",
    });
  });

  it("rejects a malformed month in either field", () => {
    expect(() => copyBudgetsSchema.parse({ fromMonth: "2026", toMonth: "2026-03" })).toThrow();
    expect(() => copyBudgetsSchema.parse({ fromMonth: "2026-02", toMonth: "March" })).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() => copyBudgetsSchema.parse({ fromMonth: "2026-02", toMonth: "2026-03", userId: "x" })).toThrow();
  });
});
