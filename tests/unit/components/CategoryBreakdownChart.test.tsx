import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart";
import type { CategoryBreakdownItemDTO } from "@/server/data/dashboard";

// Assertions target the accessible text list rendered alongside the chart,
// not the Recharts SVG -- ResponsiveContainer measures real layout
// dimensions that jsdom doesn't provide, so the chart itself is not a
// reliable thing to assert against here (see tests/setup-dom.ts and the
// component's own comment for why).
describe("CategoryBreakdownChart", () => {
  it("shows an empty-state message and no chart when there is no data", () => {
    render(<CategoryBreakdownChart data={[]} currency="USD" />);
    expect(screen.getByText("No expenses in this period yet.")).toBeInTheDocument();
  });

  it("renders each category with correctly formatted currency, not raw cents", () => {
    const data: CategoryBreakdownItemDTO[] = [
      { categoryName: "Groceries", totalCents: 5000 },
      { categoryName: "Dining", totalCents: 1500 },
    ];
    render(<CategoryBreakdownChart data={data} currency="USD" />);

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Dining")).toBeInTheDocument();
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$15\.00/)).toBeInTheDocument();

    // The raw integer cents values must never appear as standalone text.
    expect(screen.queryByText("5000")).not.toBeInTheDocument();
    expect(screen.queryByText("1500")).not.toBeInTheDocument();
  });

  it("shows each category's share of the total as a percentage", () => {
    const data: CategoryBreakdownItemDTO[] = [
      { categoryName: "Groceries", totalCents: 7500 },
      { categoryName: "Dining", totalCents: 2500 },
    ];
    render(<CategoryBreakdownChart data={data} currency="USD" />);
    expect(screen.getByText(/75%/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });
});
