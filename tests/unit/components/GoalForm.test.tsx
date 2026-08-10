import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalForm } from "@/components/goals/GoalForm";
import { createSavingsGoalAction, updateSavingsGoalAction } from "@/server/actions/savingsGoals";

vi.mock("@/server/actions/savingsGoals", () => ({
  createSavingsGoalAction: vi.fn(),
  updateSavingsGoalAction: vi.fn(),
  deleteSavingsGoalAction: vi.fn(),
  contributeToGoalAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createSavingsGoalAction).mockReset();
  vi.mocked(updateSavingsGoalAction).mockReset();
});

describe("GoalForm", () => {
  it("keeps entered values visible after a server validation failure", async () => {
    const user = userEvent.setup();
    vi.mocked(createSavingsGoalAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { target: ["Enter a valid amount, like 5,000.00."] },
    });
    render(<GoalForm mode="create" onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Emergency Fund");
    await user.type(screen.getByLabelText("Target amount"), "not-a-number");
    await user.click(screen.getByRole("button", { name: "Add goal" }));

    await waitFor(() => expect(screen.getByLabelText("Target amount")).toBeInvalid());
    expect(screen.getByLabelText("Name")).toHaveValue("Emergency Fund");
    expect(screen.getByLabelText("Target amount")).toHaveValue("not-a-number");
  });

  it("wires the field error to the input via aria-invalid and aria-describedby", async () => {
    const user = userEvent.setup();
    vi.mocked(createSavingsGoalAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { target: ["Enter a valid amount, like 5,000.00."] },
    });
    render(<GoalForm mode="create" onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Emergency Fund");
    await user.click(screen.getByRole("button", { name: "Add goal" }));

    const targetInput = screen.getByLabelText("Target amount");
    await waitFor(() => expect(targetInput).toBeInvalid());
    expect(targetInput).toHaveAccessibleDescription("Enter a valid amount, like 5,000.00.");
  });

  it("calls onSuccess after a successful submission", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(createSavingsGoalAction).mockResolvedValueOnce({
      ok: true,
      data: {
        id: "g1",
        name: "Emergency Fund",
        description: null,
        targetCents: 500000,
        startingCents: 0,
        targetDate: null,
        status: "ACTIVE",
        color: "#0ea5e9",
        achievedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    render(<GoalForm mode="create" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Name"), "Emergency Fund");
    await user.type(screen.getByLabelText("Target amount"), "5000.00");
    await user.click(screen.getByRole("button", { name: "Add goal" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("pre-fills fields from the goal in edit mode, and preserves them on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(updateSavingsGoalAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { name: ["Required"] },
    });
    const goal = {
      id: "g1",
      name: "Emergency Fund",
      description: "Six months of expenses",
      targetCents: 500000,
      startingCents: 0,
      targetDate: "2099-01-01",
      status: "ACTIVE" as const,
      color: "#0ea5e9",
      achievedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    render(<GoalForm mode="edit" goal={goal} onSuccess={vi.fn()} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Emergency Fund");
    expect(screen.getByLabelText("Target amount")).toHaveValue("5000.00");
    expect(screen.getByLabelText(/Description/)).toHaveValue("Six months of expenses");
    expect(screen.getByLabelText(/Target date/)).toHaveValue("2099-01-01");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeInvalid());
    expect(screen.getByLabelText("Name")).toHaveValue("Emergency Fund");

    expect(vi.mocked(updateSavingsGoalAction).mock.calls[0][0]).toBe("g1");
  });
});
