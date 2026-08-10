import { describe, expect, it } from "vitest";
import { recurringBillCreateSchema, recurringBillUpdateSchema, markBillPaidSchema } from "@/lib/schemas/recurringBill";

const validCreateInput = {
  name: "Rent",
  amountCents: 150000,
  dueDay: 1,
};

describe("recurringBillCreateSchema", () => {
  it("accepts a minimal valid bill", () => {
    const result = recurringBillCreateSchema.parse(validCreateInput);
    expect(result.name).toBe("Rent");
    expect(result.amountCents).toBe(150000);
    expect(result.dueDay).toBe(1);
    expect(result.categoryId).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("accepts an explicit categoryId and notes", () => {
    const result = recurringBillCreateSchema.parse({
      ...validCreateInput,
      categoryId: "clh3ans2z0000356ub9pu9q0m",
      notes: "Due on the 1st",
    });
    expect(result.categoryId).toBe("clh3ans2z0000356ub9pu9q0m");
    expect(result.notes).toBe("Due on the 1st");
  });

  it("accepts an explicit null categoryId (no category)", () => {
    expect(recurringBillCreateSchema.parse({ ...validCreateInput, categoryId: null }).categoryId).toBeNull();
  });

  it("trims the name and rejects an empty one", () => {
    expect(recurringBillCreateSchema.parse({ ...validCreateInput, name: "  Rent  " }).name).toBe("Rent");
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, name: "   " })).toThrow();
  });

  it("rejects a name over the length limit", () => {
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, name: "x".repeat(81) })).toThrow();
  });

  it("rejects a non-positive amount", () => {
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, amountCents: 0 })).toThrow();
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, amountCents: -100 })).toThrow();
  });

  it("rejects a non-integer amount", () => {
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, amountCents: 100.5 })).toThrow();
  });

  it.each([0, 32, -1, 1.5])("rejects an out-of-range dueDay: %s", (dueDay) => {
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, dueDay })).toThrow();
  });

  it.each([1, 15, 28, 30, 31])("accepts every in-range dueDay: %s", (dueDay) => {
    expect(recurringBillCreateSchema.parse({ ...validCreateInput, dueDay }).dueDay).toBe(dueDay);
  });

  it("rejects a malformed categoryId", () => {
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, categoryId: "not-a-cuid" })).toThrow();
  });

  it("rejects notes over the length limit", () => {
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, notes: "x".repeat(501) })).toThrow();
  });

  it("rejects a missing required field", () => {
    const withoutDueDay: Partial<typeof validCreateInput> = { ...validCreateInput };
    delete withoutDueDay.dueDay;
    expect(() => recurringBillCreateSchema.parse(withoutDueDay)).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, userId: "someone-else" })).toThrow();
    expect(() => recurringBillCreateSchema.parse({ ...validCreateInput, isActive: false })).toThrow();
  });
});

describe("recurringBillUpdateSchema", () => {
  it("accepts an empty object (no-op update)", () => {
    expect(recurringBillUpdateSchema.parse({})).toEqual({});
  });

  it("accepts a partial update of just the name", () => {
    expect(recurringBillUpdateSchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
  });

  it("accepts clearing notes with an explicit null", () => {
    expect(recurringBillUpdateSchema.parse({ notes: null })).toEqual({ notes: null });
  });

  it("accepts clearing categoryId with an explicit null", () => {
    expect(recurringBillUpdateSchema.parse({ categoryId: null })).toEqual({ categoryId: null });
  });

  it("still validates the fields that are provided", () => {
    expect(() => recurringBillUpdateSchema.parse({ name: "" })).toThrow();
    expect(() => recurringBillUpdateSchema.parse({ amountCents: 0 })).toThrow();
    expect(() => recurringBillUpdateSchema.parse({ dueDay: 32 })).toThrow();
  });

  it("rejects isActive -- archiving is its own action, not a general edit field", () => {
    expect(() => recurringBillUpdateSchema.parse({ isActive: false })).toThrow();
  });
});

describe("markBillPaidSchema", () => {
  it("accepts a minimal valid input and defaults logTransaction to false", () => {
    const result = markBillPaidSchema.parse({ periodMonth: "2026-03" });
    expect(result.periodMonth).toBe("2026-03");
    expect(result.logTransaction).toBe(false);
    expect(result.date).toBeUndefined();
  });

  it("accepts logTransaction: true with a date", () => {
    const result = markBillPaidSchema.parse({ periodMonth: "2026-03", logTransaction: true, date: "2026-03-15" });
    expect(result.logTransaction).toBe(true);
    expect(result.date).toBe("2026-03-15");
  });

  it("rejects a malformed periodMonth", () => {
    expect(() => markBillPaidSchema.parse({ periodMonth: "2026-3" })).toThrow();
    expect(() => markBillPaidSchema.parse({ periodMonth: "March 2026" })).toThrow();
  });

  it("rejects a malformed date", () => {
    expect(() => markBillPaidSchema.parse({ periodMonth: "2026-03", date: "03/15/2026" })).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() => markBillPaidSchema.parse({ periodMonth: "2026-03", billId: "someone-elses-bill" })).toThrow();
  });
});
