import type { IncomeSourceManagementDTO } from "@/server/data/incomeSources";

// Pure, DB-free inputs mirroring exactly what
// server/data/incomeSources.ts's getIncomeVsExpected feeds in: the active
// sources' expected amounts, and a per-source (nullable incomeSourceId)
// actual-amount breakdown for the month, straight off a
// prisma.transaction.groupBy. Kept as plain data here (not Prisma types) so
// this file stays dependency-free -- same convention as lib/budgets.ts's
// computeBudgetProgress.
export interface IncomeSourceExpected {
  id: string;
  name: string;
  expectedCents: number;
}

export interface ActualAmountBySource {
  /** null groups every INCOME transaction not tagged to any source -- see unattributedCents below. */
  incomeSourceId: string | null;
  amountCents: number;
}

export interface IncomeVsExpectedSourceDTO {
  id: string;
  name: string;
  expectedCents: number;
  actualCents: number;
}

export interface IncomeVsExpectedDTO {
  /** "YYYY-MM" */
  month: string;
  sources: IncomeVsExpectedSourceDTO[];
  /** INCOME transactions this month with no incomeSourceId -- money received but not attributed to any expected source. */
  unattributedCents: number;
  totalExpectedCents: number;
  /** Sum of every source's actualCents plus unattributedCents -- the true total INCOME received this month. */
  totalActualCents: number;
}

export interface ExpectedProgress {
  /** expectedCents - actualCents; negative once actual exceeds expected (received more than planned). */
  remainingCents: number;
  percentReceived: number;
  isFullyReceived: boolean;
}

/**
 * The per-source received-vs-expected math, mirroring lib/budgets.ts's
 * computeBudgetProgress exactly (just the inverse framing: "received
 * toward an expectation" instead of "spent against a limit"). Used by
 * components/income/IncomeVsExpectedCard.tsx to render each source's
 * progress bar.
 */
export function computeExpectedProgress(expectedCents: number, actualCents: number): ExpectedProgress {
  const remainingCents = expectedCents - actualCents;
  // Same zero-target guard as computeBudgetProgress: a zero-expected source
  // with nothing received is 0%, not NaN.
  const percentReceived =
    expectedCents > 0 ? Math.round((actualCents / expectedCents) * 100) : actualCents > 0 ? 100 : 0;
  return { remainingCents, percentReceived, isFullyReceived: expectedCents > 0 && actualCents >= expectedCents };
}

/**
 * The expected-vs-received merge math, extracted out of
 * server/data/incomeSources.ts's getIncomeVsExpected so it's unit-testable
 * without the database -- same reasoning as lib/budgets.ts's
 * computeBudgetProgress. `actuals` is expected to already be grouped by
 * incomeSourceId (one row per distinct id, including at most one `null`
 * row) -- exactly what a single `prisma.transaction.groupBy` call returns.
 */
export function computeIncomeVsExpected(
  month: string,
  sources: IncomeSourceExpected[],
  actuals: ActualAmountBySource[],
): IncomeVsExpectedDTO {
  const actualBySourceId = new Map<string, number>();
  let unattributedCents = 0;

  for (const actual of actuals) {
    if (actual.incomeSourceId === null) {
      unattributedCents += actual.amountCents;
    } else {
      actualBySourceId.set(
        actual.incomeSourceId,
        (actualBySourceId.get(actual.incomeSourceId) ?? 0) + actual.amountCents,
      );
    }
  }

  const perSource = sources.map((source) => ({
    id: source.id,
    name: source.name,
    expectedCents: source.expectedCents,
    actualCents: actualBySourceId.get(source.id) ?? 0,
  }));

  const totalExpectedCents = perSource.reduce((sum, s) => sum + s.expectedCents, 0);
  const totalActualCents = perSource.reduce((sum, s) => sum + s.actualCents, 0) + unattributedCents;

  return { month, sources: perSource, unattributedCents, totalExpectedCents, totalActualCents };
}

export type IncomeSourceOptimisticAction =
  | { type: "add"; incomeSource: IncomeSourceManagementDTO }
  | { type: "update"; id: string; patch: Partial<IncomeSourceManagementDTO> };

/**
 * Pure reducer for the useOptimistic overlay in
 * components/income/IncomeSourcesBoard.tsx -- same shape as
 * lib/categories.ts's categoryOptimisticReducer. No "remove" action: this
 * app never hard-deletes an income source, same reasoning as Category --
 * archiving is an "update" (isActive: false), covered by the update case.
 */
export function incomeSourceOptimisticReducer(
  state: IncomeSourceManagementDTO[],
  action: IncomeSourceOptimisticAction,
): IncomeSourceManagementDTO[] {
  switch (action.type) {
    case "add":
      return [...state, action.incomeSource];
    case "update":
      return state.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s));
  }
}
