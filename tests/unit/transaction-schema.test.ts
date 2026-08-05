import { describe, expect, it } from "vitest";
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionFilterSchema,
  MAX_AMOUNT_CENTS,
} from "@/lib/schemas/transaction";

const validCreateInput = {
  type: "EXPENSE" as const,
  amountCents: 1234,
  date: "2026-03-15",
  description: "Coffee",
  categoryId: "clh3ans2z0000356ub9pu9q0m",
};

describe("transactionCreateSchema", () => {
  it("accepts a valid expense payload", () => {
    const result = transactionCreateSchema.parse(validCreateInput);
    expect(result.amountCents).toBe(1234);
    expect(result.type).toBe("EXPENSE");
  });

  it("accepts a valid income payload with notes", () => {
    const result = transactionCreateSchema.parse({
      ...validCreateInput,
      type: "INCOME",
      notes: "Freelance invoice #42",
    });
    expect(result.type).toBe("INCOME");
    expect(result.notes).toBe("Freelance invoice #42");
  });

  it("rejects a zero amount", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, amountCents: 0 }),
    ).toThrow();
  });

  it("rejects a negative amount", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, amountCents: -500 }),
    ).toThrow();
  });

  it("rejects a non-integer (float) amount", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, amountCents: 12.5 }),
    ).toThrow();
  });

  it("rejects an amount beyond the Postgres INT4 ceiling", () => {
    expect(() =>
      transactionCreateSchema.parse({
        ...validCreateInput,
        amountCents: MAX_AMOUNT_CENTS + 1,
      }),
    ).toThrow();
  });

  it("rejects a malformed date", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, date: "03/15/2026" }),
    ).toThrow();
  });

  it("rejects an empty description", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, description: "   " }),
    ).toThrow();
  });

  it("rejects a description over 200 characters", () => {
    expect(() =>
      transactionCreateSchema.parse({
        ...validCreateInput,
        description: "x".repeat(201),
      }),
    ).toThrow();
  });

  it("rejects an invalid transaction type", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, type: "TRANSFER" }),
    ).toThrow();
  });

  it("rejects a missing categoryId", () => {
    const withoutCategory: Partial<typeof validCreateInput> = { ...validCreateInput };
    delete withoutCategory.categoryId;
    expect(() => transactionCreateSchema.parse(withoutCategory)).toThrow();
  });

  it("rejects a non-cuid categoryId", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, categoryId: "not-an-id" }),
    ).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, userId: "someone-else" }),
    ).toThrow();
  });

  it("rejects a client-supplied id field", () => {
    expect(() =>
      transactionCreateSchema.parse({ ...validCreateInput, id: "forged-id" }),
    ).toThrow();
  });
});

describe("transactionUpdateSchema", () => {
  it("accepts an empty object (no-op update)", () => {
    expect(transactionUpdateSchema.parse({})).toEqual({});
  });

  it("accepts a partial update of a single field", () => {
    const result = transactionUpdateSchema.parse({ description: "Updated" });
    expect(result).toEqual({ description: "Updated" });
  });

  it("still validates the fields that are provided", () => {
    expect(() => transactionUpdateSchema.parse({ amountCents: -1 })).toThrow();
  });

  it("still rejects unknown keys", () => {
    expect(() => transactionUpdateSchema.parse({ userId: "someone-else" })).toThrow();
  });
});

describe("transactionFilterSchema", () => {
  it("defaults take to 50 and skip to 0", () => {
    const result = transactionFilterSchema.parse({});
    expect(result.take).toBe(50);
    expect(result.skip).toBe(0);
  });

  it("coerces take/skip from query-param-style strings", () => {
    const result = transactionFilterSchema.parse({ take: "10", skip: "20" });
    expect(result.take).toBe(10);
    expect(result.skip).toBe(20);
  });

  it("rejects a take above 100", () => {
    expect(() => transactionFilterSchema.parse({ take: 101 })).toThrow();
  });

  it("rejects a take below 1", () => {
    expect(() => transactionFilterSchema.parse({ take: 0 })).toThrow();
  });

  it("rejects an unknown filter key", () => {
    expect(() => transactionFilterSchema.parse({ userId: "someone-else" })).toThrow();
  });

  it("accepts a full set of valid filters", () => {
    const result = transactionFilterSchema.parse({
      type: "EXPENSE",
      categoryId: "clh3ans2z0000356ub9pu9q0m",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      q: "coffee",
    });
    expect(result.type).toBe("EXPENSE");
    expect(result.q).toBe("coffee");
  });
});
