import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteGoalButton } from "@/components/goals/DeleteGoalButton";
import { deleteSavingsGoalAction } from "@/server/actions/savingsGoals";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { SavingsGoalProgressDTO } from "@/server/data/savingsGoals";
import type { ReactElement } from "react";

vi.mock("@/server/actions/savingsGoals", () => ({
  createSavingsGoalAction: vi.fn(),
  updateSavingsGoalAction: vi.fn(),
  deleteSavingsGoalAction: vi.fn(),
  contributeToGoalAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(deleteSavingsGoalAction).mockReset();
});

const goal: SavingsGoalProgressDTO = {
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
  currentCents: 30000,
  remainingCents: 70000,
  percentComplete: 30,
  isAchieved: false,
  pace: null,
};

// DeleteGoalButton calls useToast(), which throws outside a ToastProvider.
function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("DeleteGoalButton", () => {
  it("requires an explicit confirm -- opening the dialog alone never calls the action", async () => {
    const user = userEvent.setup();
    renderWithToast(<DeleteGoalButton goal={goal} />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    expect(screen.getByRole("dialog", { name: "Delete goal?" })).toBeInTheDocument();
    expect(deleteSavingsGoalAction).not.toHaveBeenCalled();
  });

  it("clicking Cancel closes the dialog without calling the action", async () => {
    const user = userEvent.setup();
    renderWithToast(<DeleteGoalButton goal={goal} />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteSavingsGoalAction).not.toHaveBeenCalled();
  });

  it("confirming closes the dialog, removes the goal optimistically, and shows an undo toast -- without calling the real action yet", async () => {
    const user = userEvent.setup();
    const onOptimisticRemove = vi.fn();
    renderWithToast(<DeleteGoalButton goal={goal} onOptimisticRemove={onOptimisticRemove} undoWindowMs={60_000} />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onOptimisticRemove).toHaveBeenCalledWith("g1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Deleted goal "Trip"')).toBeInTheDocument());
    expect(deleteSavingsGoalAction).not.toHaveBeenCalled();
  });

  it("clicking Undo restores the goal and never calls the real delete action", async () => {
    const user = userEvent.setup();
    const onOptimisticAdd = vi.fn();
    renderWithToast(<DeleteGoalButton goal={goal} onOptimisticAdd={onOptimisticAdd} undoWindowMs={60_000} />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const undoButton = await screen.findByRole("button", { name: "Undo" });
    await user.click(undoButton);

    await waitFor(() => expect(onOptimisticAdd).toHaveBeenCalledWith(goal));
    expect(deleteSavingsGoalAction).not.toHaveBeenCalled();
  });

  it("commits the real delete once the undo window elapses without a click", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteSavingsGoalAction).mockResolvedValueOnce({ ok: true, data: undefined });
    renderWithToast(<DeleteGoalButton goal={goal} undoWindowMs={20} />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSavingsGoalAction).toHaveBeenCalledWith("g1", null));
  });

  it("restores the goal and shows a notice if the real delete fails after the window elapses", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteSavingsGoalAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    const onOptimisticAdd = vi.fn();
    renderWithToast(<DeleteGoalButton goal={goal} onOptimisticAdd={onOptimisticAdd} undoWindowMs={20} />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onOptimisticAdd).toHaveBeenCalledWith(goal));
    expect(screen.getByText(/Couldn't delete "Trip"/)).toBeInTheDocument();
  });
});
