import { z } from "zod";
import { MAX_AMOUNT_CENTS } from "@/lib/schemas/transaction";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex color like #0ea5e9");

// Computed inside the refine callback (not hoisted to module scope) so
// "today" is evaluated fresh on every parse call, not frozen at the first
// import of this long-lived server module.
const futureDateOnly = dateOnly.refine((d) => d > new Date().toISOString().slice(0, 10), {
  message: "Target date must be in the future",
});

export const savingsGoalCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional(),
    targetCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS),
    targetDate: futureDateOnly.optional(),
    color: hexColorSchema.default("#0ea5e9"),
  })
  .strict();

export type SavingsGoalCreateInput = z.infer<typeof savingsGoalCreateSchema>;

// Unlike create, targetDate here is NOT required to be in the future --
// an existing goal's target date legitimately can have already passed (the
// overdue state is a real, displayed state, not an error) and a user must
// still be able to save other edits without being forced to first push the
// date out. `null` clears a previously-set date; `undefined` (the field
// simply absent from the request) leaves it untouched.
export const savingsGoalUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    targetCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS).optional(),
    targetDate: dateOnly.nullable().optional(),
    color: hexColorSchema.optional(),
  })
  .strict();

export type SavingsGoalUpdateInput = z.infer<typeof savingsGoalUpdateSchema>;

// A contribution's amountCents may be negative -- a withdrawal (see
// prisma/schema.prisma's comment on SavingsContribution) -- so this can't
// reuse transactionCreateSchema's strictly-positive amountCents. Zero is
// rejected outright: it would create a real ledger row with no effect,
// which is never a legitimate "contribution."
export const savingsContributionCreateSchema = z
  .object({
    amountCents: z
      .number()
      .int()
      .min(-MAX_AMOUNT_CENTS)
      .max(MAX_AMOUNT_CENTS)
      .refine((n) => n !== 0, { message: "Amount can't be zero" }),
    date: dateOnly,
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export type SavingsContributionCreateInput = z.infer<typeof savingsContributionCreateSchema>;
