import { describe, expect, it } from "vitest";
import {
  incomeSourceCreateSchema,
  incomeSourceUpdateSchema,
  incomeSourceFilterSchema,
  incomeVsExpectedFilterSchema,
} from "@/lib/schemas/incomeSource";
import { MAX_AMOUNT_CENTS } from "@/lib/schemas/transaction";

const validCreateInput = {
  name: "Paycheck",
  amountCents: 250000,
  payDay: 15,
};

describe("incomeSourceCreateSchema", () => {
  it("accepts a valid income source", () => {
    const result = incomeSourceCreateSchema.parse(validCreateInput);
    expect(result.name).toBe("Paycheck");
    expect(result.amountCents).toBe(250000);
    expect(result.payDay).toBe(15);
  });

  it("accepts an explicit notes field", () => {
    expect(incomeSourceCreateSchema.parse({ ...validCreateInput, notes: "Biweekly" }).notes).toBe("Biweekly");
  });

  it("trims the name and rejects an empty one", () => {
    expect(incomeSourceCreateSchema.parse({ ...validCreateInput, name: "  Salary  " }).name).toBe("Salary");
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, name: "   " })).toThrow();
  });

  it("rejects a name over the length limit", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, name: "x".repeat(81) })).toThrow();
  });

  it("rejects a zero amount", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, amountCents: 0 })).toThrow();
  });

  it("rejects a negative amount", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, amountCents: -100 })).toThrow();
  });

  it("rejects a non-integer amount", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, amountCents: 12.5 })).toThrow();
  });

  it("rejects an amount beyond the Postgres INT4 ceiling", () => {
    expect(() =>
      incomeSourceCreateSchema.parse({ ...validCreateInput, amountCents: MAX_AMOUNT_CENTS + 1 }),
    ).toThrow();
  });

  it("accepts payDay at the boundaries (1 and 31)", () => {
    expect(incomeSourceCreateSchema.parse({ ...validCreateInput, payDay: 1 }).payDay).toBe(1);
    expect(incomeSourceCreateSchema.parse({ ...validCreateInput, payDay: 31 }).payDay).toBe(31);
  });

  it("rejects a payDay of 0", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, payDay: 0 })).toThrow();
  });

  it("rejects a payDay above 31", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, payDay: 32 })).toThrow();
  });

  it("rejects a non-integer payDay", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, payDay: 15.5 })).toThrow();
  });

  it("rejects a missing required field", () => {
    const withoutName: Partial<typeof validCreateInput> = { ...validCreateInput };
    delete withoutName.name;
    expect(() => incomeSourceCreateSchema.parse(withoutName)).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, userId: "someone-else" })).toThrow();
  });

  it("rejects a client-supplied isActive field", () => {
    expect(() => incomeSourceCreateSchema.parse({ ...validCreateInput, isActive: false })).toThrow();
  });
});

describe("incomeSourceUpdateSchema", () => {
  it("accepts an empty object (no-op update)", () => {
    expect(incomeSourceUpdateSchema.parse({})).toEqual({});
  });

  it("accepts a partial update of just the name", () => {
    expect(incomeSourceUpdateSchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
  });

  it("accepts a partial update of just the amount", () => {
    expect(incomeSourceUpdateSchema.parse({ amountCents: 300000 })).toEqual({ amountCents: 300000 });
  });

  it("accepts a partial update of just the payDay", () => {
    expect(incomeSourceUpdateSchema.parse({ payDay: 5 })).toEqual({ payDay: 5 });
  });

  it("accepts clearing notes by omission (still validates the fields provided)", () => {
    expect(() => incomeSourceUpdateSchema.parse({ name: "" })).toThrow();
    expect(() => incomeSourceUpdateSchema.parse({ payDay: 32 })).toThrow();
    expect(() => incomeSourceUpdateSchema.parse({ amountCents: -1 })).toThrow();
  });

  it("rejects isActive -- not editable via the general update", () => {
    expect(() => incomeSourceUpdateSchema.parse({ isActive: false })).toThrow();
  });

  it("rejects an unknown extra field", () => {
    expect(() => incomeSourceUpdateSchema.parse({ userId: "someone-else" })).toThrow();
  });
});

describe("incomeSourceFilterSchema", () => {
  it("defaults isActive to undefined (no filter)", () => {
    expect(incomeSourceFilterSchema.parse({}).isActive).toBeUndefined();
  });

  it("accepts an explicit isActive: true", () => {
    expect(incomeSourceFilterSchema.parse({ isActive: true }).isActive).toBe(true);
  });

  it("accepts an explicit isActive: false", () => {
    expect(incomeSourceFilterSchema.parse({ isActive: false }).isActive).toBe(false);
  });

  it("rejects an unknown filter key", () => {
    expect(() => incomeSourceFilterSchema.parse({ userId: "someone-else" })).toThrow();
  });
});

describe("incomeVsExpectedFilterSchema", () => {
  it("accepts an empty object (month optional)", () => {
    expect(incomeVsExpectedFilterSchema.parse({}).month).toBeUndefined();
  });

  it("accepts a valid month", () => {
    expect(incomeVsExpectedFilterSchema.parse({ month: "2026-03" }).month).toBe("2026-03");
  });

  it("rejects a malformed month", () => {
    expect(() => incomeVsExpectedFilterSchema.parse({ month: "March 2026" })).toThrow();
  });
});
