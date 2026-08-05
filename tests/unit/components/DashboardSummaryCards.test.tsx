import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSummaryCards } from "@/components/dashboard/DashboardSummaryCards";
import type { DashboardSummaryDTO } from "@/server/data/dashboard";

describe("DashboardSummaryCards", () => {
  it("renders income, expenses, net, and savings rate using the given currency", () => {
    const summary: DashboardSummaryDTO = {
      incomeCents: 500000,
      expenseCents: 200000,
      netCents: 300000,
      savingsRatePercent: 60,
    };
    render(<DashboardSummaryCards summary={summary} currency="EUR" />);

    expect(screen.getByText("€5,000.00")).toBeInTheDocument(); // income
    expect(screen.getByText("-€2,000.00")).toBeInTheDocument(); // expenses, shown as an outflow
    expect(screen.getByText("€3,000.00")).toBeInTheDocument(); // net
    expect(screen.getByText("60%")).toBeInTheDocument();

    // Raw cents must never leak into the rendered text.
    expect(screen.queryByText("500000")).not.toBeInTheDocument();
    expect(screen.queryByText("200000")).not.toBeInTheDocument();
  });

  it("shows a dash, not NaN/Infinity, when there is no income this period", () => {
    const summary: DashboardSummaryDTO = {
      incomeCents: 0,
      expenseCents: 5000,
      netCents: -5000,
      savingsRatePercent: null,
    };
    render(<DashboardSummaryCards summary={summary} currency="USD" />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Not available (no income this period)")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });

  it("defaults to USD when no currency is provided", () => {
    const summary: DashboardSummaryDTO = { incomeCents: 1000, expenseCents: 300, netCents: 700, savingsRatePercent: 70 };
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$7.00")).toBeInTheDocument();
  });
});
