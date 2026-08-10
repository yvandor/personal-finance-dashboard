import { describe, expect, it } from "vitest";
import { categoryCreateSchema, categoryUpdateSchema } from "@/lib/schemas/category";

const validCreateInput = {
  name: "Groceries",
  type: "EXPENSE" as const,
};

describe("categoryCreateSchema", () => {
  it("accepts a valid category and defaults the color", () => {
    const result = categoryCreateSchema.parse(validCreateInput);
    expect(result.name).toBe("Groceries");
    expect(result.type).toBe("EXPENSE");
    expect(result.color).toBe("#64748b");
  });

  it("accepts an explicit hex color", () => {
    expect(categoryCreateSchema.parse({ ...validCreateInput, color: "#FF0000" }).color).toBe("#FF0000");
  });

  it("rejects a malformed color", () => {
    expect(() => categoryCreateSchema.parse({ ...validCreateInput, color: "red" })).toThrow();
    expect(() => categoryCreateSchema.parse({ ...validCreateInput, color: "#fff" })).toThrow();
  });

  it("trims the name and rejects an empty one", () => {
    expect(categoryCreateSchema.parse({ ...validCreateInput, name: "  Dining Out  " }).name).toBe("Dining Out");
    expect(() => categoryCreateSchema.parse({ ...validCreateInput, name: "   " })).toThrow();
  });

  it("rejects a name over the length limit", () => {
    expect(() => categoryCreateSchema.parse({ ...validCreateInput, name: "x".repeat(61) })).toThrow();
  });

  it("rejects an invalid type", () => {
    expect(() => categoryCreateSchema.parse({ ...validCreateInput, type: "SAVINGS" })).toThrow();
  });

  it("rejects a missing type", () => {
    const withoutType: Partial<typeof validCreateInput> = { ...validCreateInput };
    delete withoutType.type;
    expect(() => categoryCreateSchema.parse(withoutType)).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() => categoryCreateSchema.parse({ ...validCreateInput, userId: "someone-else" })).toThrow();
  });
});

describe("categoryUpdateSchema", () => {
  it("accepts an empty object (no-op update)", () => {
    expect(categoryUpdateSchema.parse({})).toEqual({});
  });

  it("accepts a partial update of just the name", () => {
    expect(categoryUpdateSchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
  });

  it("accepts a partial update of just the color", () => {
    expect(categoryUpdateSchema.parse({ color: "#112233" })).toEqual({ color: "#112233" });
  });

  it("still validates the fields that are provided", () => {
    expect(() => categoryUpdateSchema.parse({ name: "" })).toThrow();
    expect(() => categoryUpdateSchema.parse({ color: "not-a-color" })).toThrow();
  });

  it("rejects type -- not editable on an existing category", () => {
    expect(() => categoryUpdateSchema.parse({ type: "INCOME" })).toThrow();
  });
});
