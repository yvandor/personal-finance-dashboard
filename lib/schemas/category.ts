import { z } from "zod";

const categoryTypeSchema = z.enum(["INCOME", "EXPENSE"]);

// #rrggbb only -- matches the `color String @db.VarChar(7)` column and
// keeps every consumer (CategoryBadge, chart legends) able to use the value
// directly as a CSS color with no further validation.
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex color like #64748b");

export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    type: categoryTypeSchema,
    color: hexColorSchema.default("#64748b"),
  })
  .strict();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

// `type` is deliberately absent -- see updateCategory's comment in
// server/data/categories.ts for why it's not editable.
export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    color: hexColorSchema.optional(),
  })
  .strict();

export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
