import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BudgetProgressBar } from "@/components/budgets/BudgetProgressBar";

describe("BudgetProgressBar", () => {
  it('shows "On track" with correct ARIA attributes when well under budget', () => {
    render(<BudgetProgressBar percentUsed={40} isOverBudget={false} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuetext", "40% used, On track");
    expect(screen.getByText("On track")).toBeInTheDocument();
  });

  it('shows "Near limit" at 80% or above, not color alone', () => {
    render(<BudgetProgressBar percentUsed={85} isOverBudget={false} />);
    expect(screen.getByText("Near limit")).toBeInTheDocument();
  });

  it('shows "Over budget" as real text when over, and the percent is not capped in the text', () => {
    render(<BudgetProgressBar percentUsed={140} isOverBudget={true} />);
    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(screen.getByText(/140% used/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "140");
  });

  it("caps the visual bar width at 100% even when over budget", () => {
    render(<BudgetProgressBar percentUsed={140} isOverBudget={true} />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });
});
