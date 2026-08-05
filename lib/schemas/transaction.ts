import { z } from "zod";

// Matches the `transactions_amount_positive` CHECK constraint and the
// Postgres INT4 ceiling backing `amountCents Int` in the Prisma schema.
export const MIN_AMOUNT_CENTS = 1;
export const MAX_AMOUNT_CENTS = 2_147_483_647;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

// The base shape for creating a transaction. `.strict()` rejects unknown
// keys outright (e.g. a client-supplied `userId` or `id`) rather than
// silently stripping them — silent stripping is safe but hides probing.
//
// `amountCents` takes an already-validated integer number of cents, not a
// raw dollar string: there is no form yet in this phase, so parsing a
// display string ("$12.34" -> 1234) is a UI-layer concern for whichever
// phase builds the transaction form, not this schema's job.
//
// `categoryId` is required here even though the database column is
// nullable — the nullable column exists so a transaction survives its
// category being deleted (ON DELETE SET NULL), not so a transaction can be
// created without one.
export const transactionCreateSchema = z
  .object({
    type: transactionTypeSchema,
    amountCents: z.number().int().min(MIN_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS),
    date: dateOnly,
    description: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(1000).optional(),
    categoryId: z.cuid(),
  })
  .strict();

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;

// Every field optional (nothing required to be re-sent on a partial edit),
// but still strict about unknown keys.
export const transactionUpdateSchema = transactionCreateSchema.partial().strict();

export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;

// A cursor identifies a row by its (date, id) position in the
// `[userId, date desc, id desc]` index — the same compound key the DAL
// sorts by. Encoded as plain "YYYY-MM-DD_<cuid>" (not sensitive; the id is
// already visible in the page), validated here so a malformed cursor is a
// 400 at the schema boundary rather than a confusing query downstream.
const cursorSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}_[a-z0-9]+$/,
  "Expected a cursor in the form YYYY-MM-DD_<id>",
);

// Search/filter input for listing transactions. Parsed into this closed
// shape rather than passed through as a raw object — this is what prevents
// both Prisma filter-operator injection (a client passing something like
// `{ "userId": { "not": null } }`) and unbounded-result DoS (`take` is
// always bounded).
//
// Pagination is keyset (cursor-based), not offset (`skip`): `skip` requires
// Postgres to scan and discard every prior row, which degrades linearly as
// a user's history grows, despite the `[userId, date(sort: Desc), id]`
// index existing specifically to make cursor-based paging a plain indexed
// range scan instead. `direction` only matters together with a `cursor` —
// with no cursor, the query starts from the most recent transaction
// regardless of `direction`'s default.
export const transactionFilterSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    categoryId: z.cuid().optional(),
    dateFrom: dateOnly.optional(),
    dateTo: dateOnly.optional(),
    q: z.string().trim().max(100).optional(),
    take: z.coerce.number().int().min(1).max(100).default(50),
    cursor: cursorSchema.optional(),
    direction: z.enum(["next", "prev"]).default("next"),
  })
  .strict();

export type TransactionFilterInput = z.input<typeof transactionFilterSchema>;
