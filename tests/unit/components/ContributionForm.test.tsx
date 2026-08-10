import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContributionForm } from "@/components/goals/ContributionForm";
import { contributeToGoalAction } from "@/server/actions/savingsGoals";

vi.mock("@/server/actions/savingsGoals", () => ({
  createSavingsGoalAction: vi.fn(),
  updateSavingsGoalAction: vi.fn(),
  deleteSavingsGoalAction: vi.fn(),
  contributeToGoalAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(contributeToGoalAction).mockReset();
});

describe("ContributionForm", () => {
  it("defaults to Contribution direction and today's date", () => {
    render(<ContributionForm goalId="g1" onSuccess={vi.fn()} />);
    expect(screen.getByLabelText("Contribution")).toBeChecked();
    expect(screen.getByLabelText("Withdrawal")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Add contribution" })).toBeInTheDocument();
  });

  it("a quick-amount chip fills the amount field", async () => {
    const user = userEvent.setup();
    render(<ContributionForm goalId="g1" onSuccess={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "$50" }));
    expect(screen.getByLabelText("Amount")).toHaveValue("50");
  });

  it("switching to Withdrawal changes the submit button label", async () => {
    const user = userEvent.setup();
    render(<ContributionForm goalId="g1" onSuccess={vi.fn()} />);
    await user.click(screen.getByLabelText("Withdrawal"));
    expect(screen.getByRole("button", { name: "Record withdrawal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Withdrawal")).toBeChecked();
    expect(screen.getByLabelText("Contribution")).not.toBeChecked();
  });

  it("keeps entered values visible after a server validation failure", async () => {
    const user = userEvent.setup();
    vi.mocked(contributeToGoalAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { amount: ["Enter a valid amount, like 50.00."] },
    });
    render(<ContributionForm goalId="g1" onSuccess={vi.fn()} />);

    await user.click(screen.getByLabelText("Withdrawal"));
    await user.type(screen.getByLabelText("Amount"), "not-a-number");
    await user.type(screen.getByLabelText(/Note/), "oops");
    await user.click(screen.getByRole("button", { name: "Record withdrawal" }));

    await waitFor(() => expect(screen.getByLabelText("Amount")).toBeInvalid());
    expect(screen.getByLabelText("Amount")).toHaveValue("not-a-number");
    expect(screen.getByLabelText(/Note/)).toHaveValue("oops");
    expect(screen.getByLabelText("Withdrawal")).toBeChecked();
  });

  it("calls onSuccess and passes the goal id as the bound action's first argument", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(contributeToGoalAction).mockResolvedValueOnce({
      ok: true,
      data: {
        id: "g1",
        name: "Trip",
        description: null,
        targetCents: 100000,
        startingCents: 0,
        targetDate: null,
        status: "ACTIVE",
        color: "#0ea5e9",
        achievedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        currentCents: 5000,
        remainingCents: 95000,
        percentComplete: 5,
        isAchieved: false,
        pace: null,
      },
    });
    render(<ContributionForm goalId="g1" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Amount"), "50.00");
    await user.click(screen.getByRole("button", { name: "Add contribution" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(vi.mocked(contributeToGoalAction).mock.calls[0][0]).toBe("g1");
  });
});
