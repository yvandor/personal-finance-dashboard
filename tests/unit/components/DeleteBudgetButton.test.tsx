import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteBudgetButton } from "@/components/budgets/DeleteBudgetButton";
import { deleteBudgetAction } from "@/server/actions/budgets";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { BudgetProgressDTO } from "@/server/data/budgets";
import type { ReactElement } from "react";

vi.mock("@/server/actions/budgets", () => ({
  createBudgetAction: vi.fn(),
  updateBudgetAction: vi.fn(),
  deleteBudgetAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(deleteBudgetAction).mockReset();
});

const budget: BudgetProgressDTO = {
  id: "b1",
  categoryId: "cat1",
  categoryName: "Groceries",
  month: "2026-03",
  amountCents: 30000,
  notes: null,
  spentCents: 10000,
  remainingCents: 20000,
  percentUsed: 33,
  isOverBudget: false,
};

// DeleteBudgetButton calls useToast(), which throws outside a ToastProvider.
function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("DeleteBudgetButton", () => {
  it("requires an explicit confirm -- opening the dialog alone never calls the action", async () => {
    const user = userEvent.setup();
    renderWithToast(<DeleteBudgetButton budget={budget} />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    expect(screen.getByRole("dialog", { name: "Delete budget?" })).toBeInTheDocument();
    expect(deleteBudgetAction).not.toHaveBeenCalled();
  });

  it("clicking Cancel closes the dialog without calling the action", async () => {
    const user = userEvent.setup();
    renderWithToast(<DeleteBudgetButton budget={budget} />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteBudgetAction).not.toHaveBeenCalled();
  });

  it("confirming closes the dialog, removes the row optimistically, and shows an undo toast -- without calling the real action yet", async () => {
    const user = userEvent.setup();
    const onOptimisticRemove = vi.fn();
    renderWithToast(<DeleteBudgetButton budget={budget} onOptimisticRemove={onOptimisticRemove} undoWindowMs={60_000} />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onOptimisticRemove).toHaveBeenCalledWith("b1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Deleted budget for "Groceries"')).toBeInTheDocument());
    expect(deleteBudgetAction).not.toHaveBeenCalled();
  });

  it("clicking Undo restores the row and never calls the real delete action", async () => {
    const user = userEvent.setup();
    const onOptimisticAdd = vi.fn();
    renderWithToast(
      <DeleteBudgetButton budget={budget} onOptimisticAdd={onOptimisticAdd} undoWindowMs={60_000} />,
    );

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const undoButton = await screen.findByRole("button", { name: "Undo" });
    await user.click(undoButton);

    await waitFor(() => expect(onOptimisticAdd).toHaveBeenCalledWith(budget));
    expect(deleteBudgetAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("commits the real delete once the undo window elapses without a click", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteBudgetAction).mockResolvedValueOnce({ ok: true, data: undefined });
    renderWithToast(<DeleteBudgetButton budget={budget} undoWindowMs={20} />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteBudgetAction).toHaveBeenCalledWith("b1", null));
  });

  it("restores the row and shows a notice if the real delete fails after the window elapses", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteBudgetAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    const onOptimisticAdd = vi.fn();
    renderWithToast(<DeleteBudgetButton budget={budget} onOptimisticAdd={onOptimisticAdd} undoWindowMs={20} />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onOptimisticAdd).toHaveBeenCalledWith(budget));
    expect(screen.getByText(/Couldn't delete the budget for "Groceries"/)).toBeInTheDocument();
  });
});
