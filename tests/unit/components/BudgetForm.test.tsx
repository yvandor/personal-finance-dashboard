import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { createBudgetAction, updateBudgetAction } from "@/server/actions/budgets";
import type { CategoryDTO } from "@/server/data/categories";

// Server Actions are the external boundary -- same reasoning as
// TransactionForm.test.tsx and BudgetList.test.tsx.
vi.mock("@/server/actions/budgets", () => ({
  createBudgetAction: vi.fn(),
  updateBudgetAction: vi.fn(),
  deleteBudgetAction: vi.fn(),
}));

const categories: CategoryDTO[] = [
  { id: "cat-groceries", type: "EXPENSE", name: "Groceries", color: "#000" },
  { id: "cat-dining", type: "EXPENSE", name: "Dining Out", color: "#000" },
];

beforeEach(() => {
  vi.mocked(createBudgetAction).mockReset();
  vi.mocked(updateBudgetAction).mockReset();
});

describe("BudgetForm", () => {
  it("keeps entered values visible after a server validation failure", async () => {
    const user = userEvent.setup();
    vi.mocked(createBudgetAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { amount: ["Enter a valid amount, like 250.00."] },
    });
    render(<BudgetForm mode="create" categories={categories} month="2026-03" onSuccess={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Category"), "cat-dining");
    await user.type(screen.getByLabelText("Monthly limit"), "not-a-number");
    await user.type(screen.getByLabelText(/Notes/), "Watch this closely");
    await user.click(screen.getByRole("button", { name: "Add budget" }));

    await waitFor(() => expect(screen.getByLabelText("Monthly limit")).toBeInvalid());

    expect(screen.getByLabelText("Category")).toHaveValue("cat-dining");
    expect(screen.getByLabelText("Monthly limit")).toHaveValue("not-a-number");
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Watch this closely");
  });

  it("wires the field error to the input via aria-invalid and aria-describedby", async () => {
    const user = userEvent.setup();
    vi.mocked(createBudgetAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { amount: ["Enter a valid amount, like 250.00."] },
    });
    render(<BudgetForm mode="create" categories={categories} month="2026-03" onSuccess={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Category"), "cat-groceries");
    await user.click(screen.getByRole("button", { name: "Add budget" }));

    const amountInput = screen.getByLabelText("Monthly limit");
    await waitFor(() => expect(amountInput).toBeInvalid());
    expect(amountInput).toHaveAccessibleDescription("Enter a valid amount, like 250.00.");
  });

  it("calls onSuccess after a successful submission", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(createBudgetAction).mockResolvedValueOnce({
      ok: true,
      data: { id: "b1", categoryId: "cat-groceries", categoryName: "Groceries", month: "2026-03", amountCents: 30000, notes: null },
    });
    render(<BudgetForm mode="create" categories={categories} month="2026-03" onSuccess={onSuccess} />);

    await user.selectOptions(screen.getByLabelText("Category"), "cat-groceries");
    await user.type(screen.getByLabelText("Monthly limit"), "300.00");
    await user.click(screen.getByRole("button", { name: "Add budget" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("shows a message and disables submit when every expense category is already budgeted", () => {
    render(<BudgetForm mode="create" categories={[]} month="2026-03" onSuccess={vi.fn()} />);

    expect(screen.getByText("Every expense category already has a budget this month.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add budget" })).toBeDisabled();
  });

  it("shows the category as read-only text (not a select) in edit mode, and preserves the amount on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(updateBudgetAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { amount: ["Enter a valid amount, like 250.00."] },
    });
    const budget = {
      id: "b1",
      categoryId: "cat-groceries",
      categoryName: "Groceries",
      month: "2026-03",
      amountCents: 30000,
      notes: null,
    };
    render(<BudgetForm mode="edit" budget={budget} month="2026-03" onSuccess={vi.fn()} />);

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Monthly limit")).toHaveValue("300.00");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByLabelText("Monthly limit")).toBeInvalid());
    expect(screen.getByLabelText("Monthly limit")).toHaveValue("300.00");

    expect(vi.mocked(updateBudgetAction).mock.calls[0][0]).toBe("b1");
  });
});
