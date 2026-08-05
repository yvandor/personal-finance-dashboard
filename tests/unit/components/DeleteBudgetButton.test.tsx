import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteBudgetButton } from "@/components/budgets/DeleteBudgetButton";
import { deleteBudgetAction } from "@/server/actions/budgets";

vi.mock("@/server/actions/budgets", () => ({
  createBudgetAction: vi.fn(),
  updateBudgetAction: vi.fn(),
  deleteBudgetAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(deleteBudgetAction).mockReset();
});

describe("DeleteBudgetButton", () => {
  it("requires an explicit confirm -- opening the dialog alone never calls the action", async () => {
    const user = userEvent.setup();
    render(<DeleteBudgetButton id="b1" categoryName="Groceries" />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    expect(screen.getByRole("dialog", { name: "Delete budget?" })).toBeInTheDocument();
    expect(deleteBudgetAction).not.toHaveBeenCalled();
  });

  it("clicking Cancel closes the dialog without calling the action", async () => {
    const user = userEvent.setup();
    render(<DeleteBudgetButton id="b1" categoryName="Groceries" />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteBudgetAction).not.toHaveBeenCalled();
  });

  it("clicking the confirm button calls deleteBudgetAction with the budget id", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteBudgetAction).mockResolvedValueOnce({ ok: true, data: undefined });
    render(<DeleteBudgetButton id="b1" categoryName="Groceries" />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteBudgetAction).toHaveBeenCalledWith("b1", null));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the error and keeps the dialog open when the action fails", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteBudgetAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    render(<DeleteBudgetButton id="b1" categoryName="Groceries" />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
