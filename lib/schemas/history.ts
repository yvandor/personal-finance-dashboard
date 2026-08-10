import { z } from "zod";

// Validates the history page's single query param: how many trailing
// months (including the current one) to show. Same closed-shape-input
// discipline as lib/schemas/dashboard.ts's dashboardFilterSchema.
// `z.coerce.number()` because this always arrives as a URL search-param
// string, never a real number -- `.optional()` (rather than `.default()`)
// so the DAL, not this schema, owns the actual default value, the same way
// server/data/budgets.ts's listBudgetsWithProgress defaults `month` itself
// rather than baking the default into budgetFilterSchema.
export const historyFilterSchema = z
  .object({
    monthsBack: z.coerce.number().int().min(1).max(24).optional(),
  })
  .strict();

export type HistoryFilterInput = z.input<typeof historyFilterSchema>;
