import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendChart } from "@/components/dashboard/TrendChart";
import type { MonthlyTrendPointDTO } from "@/server/data/dashboard";

// Assertions target the accessible text table rendered alongside the
// chart, not the Recharts SVG -- see CategoryBreakdownChart.test.tsx for
// why (jsdom / ResponsiveContainer sizing).
describe("TrendChart", () => {
  it("shows an empty-state message when every month in the period is zero", () => {
    const data: MonthlyTrendPointDTO[] = [
      { month: "2026-01", incomeCents: 0, expenseCents: 0 },
      { month: "2026-02", incomeCents: 0, expenseCents: 0 },
    ];
    render(<TrendChart data={data} currency="USD" />);
    expect(screen.getByText("No transactions in this period yet.")).toBeInTheDocument();
  });

  it("renders the table with correctly formatted currency for each month, not raw cents", () => {
    const data: MonthlyTrendPointDTO[] = [
      { month: "2026-01", incomeCents: 500000, expenseCents: 200000 },
      { month: "2026-02", incomeCents: 0, expenseCents: 0 },
    ];
    render(<TrendChart data={data} currency="USD" />);

    expect(screen.getByText("Jan 2026")).toBeInTheDocument();
    expect(screen.getByText("Feb 2026")).toBeInTheDocument();
    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
    expect(screen.getByText("$2,000.00")).toBeInTheDocument();

    // Raw integer cents must never appear as standalone visible text.
    expect(screen.queryByText("500000")).not.toBeInTheDocument();
    expect(screen.queryByText("200000")).not.toBeInTheDocument();
  });

  it("renders in a different currency correctly", () => {
    const data: MonthlyTrendPointDTO[] = [{ month: "2026-03", incomeCents: 100000, expenseCents: 50000 }];
    render(<TrendChart data={data} currency="EUR" />);
    expect(screen.getByText("€1,000.00")).toBeInTheDocument();
    expect(screen.getByText("€500.00")).toBeInTheDocument();
  });
});
