import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HistoryTable } from "@/components/history/HistoryTable";
import type { MonthlyHistoryDTO } from "@/server/data/history";

// HistoryTable renders both a desktop table and a mobile card list
// simultaneously (one CSS-hidden per breakpoint, same pattern as
// components/transactions/TransactionList.tsx) -- jsdom has no real
// viewport, so both trees are present in the DOM at once. Assertions that
// would otherwise match text in both trees are scoped to the table via
// `within(screen.getByRole("table"))`, the same discipline
// tests/unit/components/BudgetList.test.tsx uses for its closed-dialog
// duplicate content.
function makeRow(overrides: Partial<MonthlyHistoryDTO> = {}): MonthlyHistoryDTO {
  return {
    month: "2026-03",
    incomeCents: 500000,
    expenseCents: 200000,
    netCents: 300000,
    totalBudgetedCents: 40000,
    totalSpentCents: 25000,
    billsPaidCount: 2,
    billsTotalCount: 3,
    ...overrides,
  };
}

describe("HistoryTable", () => {
  it("shows an empty-state message when there is no history", () => {
    render(<HistoryTable history={[]} currency="USD" />);
    expect(screen.getByText("No history yet")).toBeInTheDocument();
  });

  it("renders a row with correctly formatted currency, not raw cents", () => {
    render(<HistoryTable history={[makeRow()]} currency="USD" />);
    const table = within(screen.getByRole("table"));

    expect(table.getByText("Mar 2026")).toBeInTheDocument();
    expect(table.getByText("$5,000.00")).toBeInTheDocument(); // income
    expect(table.getByText("-$2,000.00")).toBeInTheDocument(); // expenses
    expect(table.getByText("$3,000.00")).toBeInTheDocument(); // net
    expect(table.getByText("$400.00")).toBeInTheDocument(); // budgeted
    expect(table.getByText("$250.00")).toBeInTheDocument(); // spent
    expect(table.getByText("2 of 3")).toBeInTheDocument(); // bills

    // Raw integer cents must never appear as standalone visible text.
    expect(screen.queryByText("500000")).not.toBeInTheDocument();
    expect(screen.queryByText("200000")).not.toBeInTheDocument();
  });

  it("links income and expenses cells to the transactions page filtered to that month's date range", () => {
    render(<HistoryTable history={[makeRow({ month: "2026-02" })]} currency="USD" />);
    const table = within(screen.getByRole("table"));

    const links = table.getAllByRole("link", { name: /5,000|2,000/ });
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/transactions?dateFrom=2026-02-01&dateTo=2026-02-28");
    }
  });

  it("links budgeted and spent cells to the budgets page filtered to that month", () => {
    render(<HistoryTable history={[makeRow({ month: "2026-02" })]} currency="USD" />);
    const table = within(screen.getByRole("table"));

    const links = table.getAllByRole("link", { name: /400\.00|250\.00/ });
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/budgets?month=2026-02");
    }
  });

  it("renders one row per month, ordered as given", () => {
    render(
      <HistoryTable
        history={[makeRow({ month: "2026-01" }), makeRow({ month: "2026-02" }), makeRow({ month: "2026-03" })]}
        currency="USD"
      />,
    );
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Jan 2026")).toBeInTheDocument();
    expect(table.getByText("Feb 2026")).toBeInTheDocument();
    expect(table.getByText("Mar 2026")).toBeInTheDocument();
  });

  it("renders a different currency correctly", () => {
    render(<HistoryTable history={[makeRow()]} currency="EUR" />);
    const table = within(screen.getByRole("table"));
    expect(table.getAllByText(/€/).length).toBeGreaterThan(0);
  });
});
