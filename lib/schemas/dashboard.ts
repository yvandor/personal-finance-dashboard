import { z } from "zod";

export const dashboardPeriodSchema = z.enum([
  "current-month",
  "last-3-months",
  "last-6-months",
  "current-year",
]);

// A closed enum, not a free-form date range -- the client can only ever
// select one of four predefined windows, never widen a query to an
// arbitrary date span.
export const dashboardFilterSchema = z
  .object({
    period: dashboardPeriodSchema.default("current-month"),
  })
  .strict();

export type DashboardFilterInput = z.input<typeof dashboardFilterSchema>;
