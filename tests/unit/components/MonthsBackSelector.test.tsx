import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthsBackSelector } from "@/components/history/MonthsBackSelector";

// Navigation is the external boundary here (explicitly allowed to mock),
// the same way components/dashboard/PeriodSelector.test.tsx mocks
// next/navigation -- MonthsBackSelector's own logic (building the next URL
// from the current search params) is real.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams("monthsBack=6"),
}));

describe("MonthsBackSelector", () => {
  it("navigates to the new monthsBack value while preserving the path", async () => {
    const user = userEvent.setup();
    render(<MonthsBackSelector monthsBack={6} />);

    await user.selectOptions(screen.getByLabelText("Show"), "12");

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/history?monthsBack=12");
  });

  it("shows the current monthsBack value as selected", () => {
    render(<MonthsBackSelector monthsBack={12} />);
    expect(screen.getByLabelText("Show")).toHaveValue("12");
  });
});
