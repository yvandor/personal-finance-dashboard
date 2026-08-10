import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncomeStatusSummary } from "@/components/dashboard/IncomeStatusSummary";

describe("IncomeStatusSummary", () => {
  it("shows a setup prompt linking to /income when there are no sources", () => {
    render(
      <IncomeStatusSummary
        status={{ month: "2026-03", sources: [], unattributedCents: 0, totalExpectedCents: 0, totalActualCents: 0 }}
      />,
    );
    expect(screen.getByText(/No income sources set up/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add one" })).toHaveAttribute("href", "/income");
  });

  it("shows actual vs expected totals when sources exist", () => {
    render(
      <IncomeStatusSummary
        status={{
          month: "2026-03",
          sources: [{ id: "s1", name: "Paycheck", expectedCents: 250000, actualCents: 250000 }],
          unattributedCents: 0,
          totalExpectedCents: 250000,
          totalActualCents: 250000,
        }}
        currency="USD"
      />,
    );
    expect(screen.getAllByText("$2,500.00")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "View income" })).toHaveAttribute("href", "/income");
  });
});
