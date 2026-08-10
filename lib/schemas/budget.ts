import { z } from "zod";
import { MAX_AMOUNT_CENTS } from "@/lib/schemas/transaction";

export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Expected a month in YYYY-MM format");

// Budgets are allowed to be zero (the `budgets_amount_nonneg` CHECK
// constraint permits it, and it's a legitimate "track this category but
// don't allocate anything yet" state) -- unlike transactions, which must
// be strictly positive.
export const budgetCreateSchema = z
  .object({
    categoryId: z.cuid(),
    month: monthSchema,
    amountCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;

// Category and month are deliberately not editable on an existing budget --
// moving a budget to a different category/month is a delete-and-recreate,
// which sidesteps re-running the duplicate/category-type checks against a
// shifting target and keeps the unique constraint's meaning simple.
export const budgetUpdateSchema = z
  .object({
    amountCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;

export const budgetFilterSchema = z
  .object({
    month: monthSchema.optional(),
  })
  .strict();

export type BudgetFilterInput = z.input<typeof budgetFilterSchema>;

export const copyBudgetsSchema = z
  .object({
    fromMonth: monthSchema,
    toMonth: monthSchema,
  })
  .strict();

export type CopyBudgetsInput = z.infer<typeof copyBudgetsSchema>;
