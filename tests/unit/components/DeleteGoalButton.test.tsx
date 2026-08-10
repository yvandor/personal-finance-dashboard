import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteGoalButton } from "@/components/goals/DeleteGoalButton";
import { deleteSavingsGoalAction } from "@/server/actions/savingsGoals";

vi.mock("@/server/actions/savingsGoals", () => ({
  createSavingsGoalAction: vi.fn(),
  updateSavingsGoalAction: vi.fn(),
  deleteSavingsGoalAction: vi.fn(),
  contributeToGoalAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(deleteSavingsGoalAction).mockReset();
});

describe("DeleteGoalButton", () => {
  it("requires an explicit confirm -- opening the dialog alone never calls the action", async () => {
    const user = userEvent.setup();
    render(<DeleteGoalButton id="g1" name="Trip" />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    expect(screen.getByRole("dialog", { name: "Delete goal?" })).toBeInTheDocument();
    expect(deleteSavingsGoalAction).not.toHaveBeenCalled();
  });

  it("clicking Cancel closes the dialog without calling the action", async () => {
    const user = userEvent.setup();
    render(<DeleteGoalButton id="g1" name="Trip" />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteSavingsGoalAction).not.toHaveBeenCalled();
  });

  it("clicking the confirm button calls deleteSavingsGoalAction with the goal id", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteSavingsGoalAction).mockResolvedValueOnce({ ok: true, data: undefined });
    render(<DeleteGoalButton id="g1" name="Trip" />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSavingsGoalAction).toHaveBeenCalledWith("g1", null));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the error and keeps the dialog open when the action fails", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteSavingsGoalAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    render(<DeleteGoalButton id="g1" name="Trip" />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
