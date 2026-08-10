import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import { deleteTransactionAction } from "@/server/actions/transactions";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { TransactionDTO } from "@/server/data/transactions";
import type { ReactElement } from "react";

vi.mock("@/server/actions/transactions", () => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  deleteTransactionAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(deleteTransactionAction).mockReset();
});

const transaction: TransactionDTO = {
  id: "t1",
  userId: "u1",
  type: "EXPENSE",
  amountCents: 1000,
  date: "2026-03-10",
  description: "Coffee",
  notes: null,
  categoryId: "cat1",
  createdAt: "2026-03-10T00:00:00.000Z",
  updatedAt: "2026-03-10T00:00:00.000Z",
};

// DeleteTransactionButton calls useToast(), which throws outside a ToastProvider.
function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("DeleteTransactionButton", () => {
  it("requires an explicit confirm -- opening the dialog alone never calls the action", async () => {
    const user = userEvent.setup();
    renderWithToast(<DeleteTransactionButton transaction={transaction} compact />);

    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    expect(screen.getByRole("dialog", { name: "Delete transaction?" })).toBeInTheDocument();
    expect(deleteTransactionAction).not.toHaveBeenCalled();
  });

  it("clicking Cancel closes the dialog without calling the action", async () => {
    const user = userEvent.setup();
    renderWithToast(<DeleteTransactionButton transaction={transaction} compact />);

    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteTransactionAction).not.toHaveBeenCalled();
  });

  it("confirming closes the dialog, removes the row optimistically, and shows an undo toast -- without calling the real action yet", async () => {
    const user = userEvent.setup();
    const onOptimisticRemove = vi.fn();
    renderWithToast(
      <DeleteTransactionButton
        transaction={transaction}
        compact
        onOptimisticRemove={onOptimisticRemove}
        undoWindowMs={60_000}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onOptimisticRemove).toHaveBeenCalledWith("t1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Deleted "Coffee"')).toBeInTheDocument());
    expect(deleteTransactionAction).not.toHaveBeenCalled();
  });

  it("clicking Undo restores the row and never calls the real delete action", async () => {
    const user = userEvent.setup();
    const onOptimisticAdd = vi.fn();
    renderWithToast(
      <DeleteTransactionButton
        transaction={transaction}
        compact
        onOptimisticAdd={onOptimisticAdd}
        undoWindowMs={60_000}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const undoButton = await screen.findByRole("button", { name: "Undo" });
    await user.click(undoButton);

    await waitFor(() => expect(onOptimisticAdd).toHaveBeenCalledWith(transaction));
    expect(deleteTransactionAction).not.toHaveBeenCalled();
  });

  it("commits the real delete once the undo window elapses without a click", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteTransactionAction).mockResolvedValueOnce({ ok: true, data: undefined });
    renderWithToast(<DeleteTransactionButton transaction={transaction} compact undoWindowMs={20} />);

    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteTransactionAction).toHaveBeenCalledWith("t1", null));
  });

  it("restores the row and shows a notice if the real delete fails after the window elapses", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteTransactionAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    const onOptimisticAdd = vi.fn();
    renderWithToast(
      <DeleteTransactionButton transaction={transaction} compact onOptimisticAdd={onOptimisticAdd} undoWindowMs={20} />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onOptimisticAdd).toHaveBeenCalledWith(transaction));
    expect(screen.getByText(/Couldn't delete "Coffee"/)).toBeInTheDocument();
  });

  it("renders the non-compact (labeled) variant for the mobile card list", () => {
    render(
      <ToastProvider>
        <DeleteTransactionButton transaction={transaction} />
      </ToastProvider>,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
