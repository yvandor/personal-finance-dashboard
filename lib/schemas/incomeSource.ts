import { z } from "zod";
import { MIN_AMOUNT_CENTS, MAX_AMOUNT_CENTS } from "@/lib/schemas/transaction";

// payDay is a raw 1-31 day-of-month, clamped to the real last day of a
// given month only at read time (lib/dates.ts's clampDayToMonth) -- never
// stored pre-clamped, so a source created with payDay=31 still means "end
// of month" in February. See prisma/schema.prisma's comment on IncomeSource.
const payDaySchema = z.number().int().min(1).max(31);

export const incomeSourceCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    // Expected amount must be strictly positive -- same reasoning as
    // transactionCreateSchema's amountCents: a $0 "expected" source isn't a
    // meaningful thing to track expected-vs-received against.
    amountCents: z.number().int().min(MIN_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS),
    payDay: payDaySchema,
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type IncomeSourceCreateInput = z.infer<typeof incomeSourceCreateSchema>;

// Every field editable on an existing source (unlike Category's `type`) --
// see server/data/incomeSources.ts's updateIncomeSource. `isActive` is
// deliberately absent here, same as Category's `isArchived`: it's toggled
// only via the dedicated archive/unarchive actions, never through a general
// update.
export const incomeSourceUpdateSchema = incomeSourceCreateSchema.partial().strict();

export type IncomeSourceUpdateInput = z.infer<typeof incomeSourceUpdateSchema>;

export const incomeSourceFilterSchema = z
  .object({
    isActive: z.boolean().optional(),
  })
  .strict();

export type IncomeSourceFilterInput = z.input<typeof incomeSourceFilterSchema>;

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Expected a month in YYYY-MM format");

export const incomeVsExpectedFilterSchema = z
  .object({
    month: monthSchema.optional(),
  })
  .strict();

export type IncomeVsExpectedFilterInput = z.input<typeof incomeVsExpectedFilterSchema>;
