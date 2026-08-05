import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";

// Navigation is the external boundary here (explicitly allowed to mock),
// the same way Server Actions are mocked elsewhere -- PeriodSelector's own
// logic (building the next URL from the current search params) is real.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams("period=current-month"),
}));

describe("PeriodSelector", () => {
  it("navigates to the new period while preserving the path", async () => {
    const user = userEvent.setup();
    render(<PeriodSelector period="current-month" />);

    await user.selectOptions(screen.getByLabelText("Period"), "last-3-months");

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/dashboard?period=last-3-months");
  });

  it("shows the current period as selected", () => {
    render(<PeriodSelector period="current-year" />);
    expect(screen.getByLabelText("Period")).toHaveValue("current-year");
  });
});
