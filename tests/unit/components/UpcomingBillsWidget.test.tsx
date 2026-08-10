import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpcomingBillsWidget } from "@/components/dashboard/UpcomingBillsWidget";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";

function makeBill(overrides: Partial<RecurringBillWithStatusDTO> = {}): RecurringBillWithStatusDTO {
  return {
    id: "b1",
    name: "Internet",
    amountCents: 5999,
    dueDay: 15,
    categoryId: null,
    categoryName: null,
    isActive: true,
    notes: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    isPaidThisMonth: false,
    status: "UPCOMING",
    dueDate: "2026-03-15",
    daysUntilDue: 5,
    ...overrides,
  };
}

describe("UpcomingBillsWidget", () => {
  it("shows a setup prompt linking to /bills when there are no active bills", () => {
    render(<UpcomingBillsWidget bills={[]} />);
    expect(screen.getByText(/No recurring bills set up/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add one" })).toHaveAttribute("href", "/bills");
  });

  it("shows an all-paid message when every active bill is paid this month", () => {
    render(<UpcomingBillsWidget bills={[makeBill({ status: "PAID", isPaidThisMonth: true })]} />);
    expect(screen.getByText("All bills paid")).toBeInTheDocument();
  });

  it("lists outstanding bills with status and amount, excluding paid and archived ones", () => {
    render(
      <UpcomingBillsWidget
        bills={[
          makeBill({ id: "b1", name: "Internet", status: "OVERDUE" }),
          makeBill({ id: "b2", name: "Streaming", status: "PAID", isPaidThisMonth: true }),
          makeBill({ id: "b3", name: "Old Gym", status: "OVERDUE", isActive: false }),
        ]}
        currency="USD"
      />,
    );
    expect(screen.getByText("Internet")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("-$59.99")).toBeInTheDocument();
    expect(screen.queryByText("Streaming")).not.toBeInTheDocument();
    expect(screen.queryByText("Old Gym")).not.toBeInTheDocument();
  });

  it("caps the list at 5 bills", () => {
    const bills = Array.from({ length: 7 }, (_, i) => makeBill({ id: `b${i}`, name: `Bill ${i}` }));
    render(<UpcomingBillsWidget bills={bills} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
