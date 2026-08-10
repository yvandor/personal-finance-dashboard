import { z } from "zod";
import { MAX_AMOUNT_CENTS } from "@/lib/schemas/transaction";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Expected a month in YYYY-MM format");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

// dueDay is a bare 1-31, never a real date -- prisma/schema.prisma's comment
// on RecurringBill.dueDay and lib/dates.ts's clampDayToMonth explain why: a
// value of 31 means "end of month" everywhere, clamped only at read time,
// never stored pre-clamped.
const dueDaySchema = z.number().int().min(1).max(31);

export const recurringBillCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    amountCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS),
    dueDay: dueDaySchema,
    // Optional -- only needed if a payment should be able to log a
    // transaction (see server/data/recurringBills.ts's assertBillableCategory
    // and the schema's own comment on RecurringBill.categoryId).
    categoryId: z.cuid().nullable().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type RecurringBillCreateInput = z.infer<typeof recurringBillCreateSchema>;

// isActive is deliberately absent -- same reasoning as
// server/data/categories.ts's archiveCategory being a separate function from
// updateCategory: archiving/restoring a bill is its own action
// (server/data/recurringBills.ts's archiveRecurringBill/unarchiveRecurringBill),
// not a field on a general edit.
export const recurringBillUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    amountCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS).optional(),
    dueDay: dueDaySchema.optional(),
    categoryId: z.cuid().nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type RecurringBillUpdateInput = z.infer<typeof recurringBillUpdateSchema>;

// Marking a bill paid for a given month. `logTransaction: true` requires the
// bill to already have a categoryId -- enforced in the DAL (it depends on
// the bill row, not just this input), not here. `date` is the logged
// transaction's date when `logTransaction` is true; the DAL defaults it to
// "today" when omitted, so it's optional here rather than conditionally
// required.
export const markBillPaidSchema = z
  .object({
    periodMonth: monthSchema,
    logTransaction: z.boolean().default(false),
    date: dateOnly.optional(),
  })
  .strict();

export type MarkBillPaidInput = z.infer<typeof markBillPaidSchema>;
