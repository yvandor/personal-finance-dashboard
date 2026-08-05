import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BudgetStatusSummary } from "@/components/dashboard/BudgetStatusSummary";

describe("BudgetStatusSummary", () => {
  it("shows a setup prompt linking to /budgets when there are no budgets", () => {
    render(
      <BudgetStatusSummary
        status={{ budgetCount: 0, totalBudgetedCents: 0, totalSpentCents: 0, overBudgetCount: 0 }}
      />,
    );
    expect(screen.getByText(/No budgets set for this month/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set one up" })).toHaveAttribute("href", "/budgets");
  });

  it("shows totals and an over-budget count when budgets exist", () => {
    render(
      <BudgetStatusSummary
        status={{ budgetCount: 3, totalBudgetedCents: 100000, totalSpentCents: 60000, overBudgetCount: 1 }}
        currency="USD"
      />,
    );
    expect(screen.getByText("$600.00")).toBeInTheDocument();
    expect(screen.getByText(/\$1,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/1 category over budget/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View budgets" })).toHaveAttribute("href", "/budgets");
  });

  it("does not show an over-budget note when nothing is over", () => {
    render(
      <BudgetStatusSummary
        status={{ budgetCount: 2, totalBudgetedCents: 50000, totalSpentCents: 10000, overBudgetCount: 0 }}
      />,
    );
    expect(screen.queryByText(/over budget/)).not.toBeInTheDocument();
  });
});
