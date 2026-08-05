import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { createTransactionAction, updateTransactionAction } from "@/server/actions/transactions";
import type { CategoryDTO } from "@/server/data/categories";
import type { ActionResult } from "@/lib/result";
import type { TransactionDTO } from "@/server/data/transactions";

// Server Actions are the external boundary here (same reasoning as
// BudgetList.test.tsx's mock of @/server/actions/budgets): Vite/Vitest
// doesn't compile away "use server" the way Next's bundler does, so the
// real module would otherwise import the server-only-guarded DAL and
// throw. Everything else -- useActionState wiring, controlled inputs,
// aria plumbing -- is real component behavior, not mocked.
vi.mock("@/server/actions/transactions", () => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
}));

const categories: CategoryDTO[] = [
  { id: "cat-groceries", type: "EXPENSE", name: "Groceries", color: "#000" },
  { id: "cat-dining", type: "EXPENSE", name: "Dining Out", color: "#000" },
  { id: "cat-salary", type: "INCOME", name: "Salary", color: "#000" },
  { id: "cat-freelance", type: "INCOME", name: "Freelance", color: "#000" },
];

function okResult(data: Partial<TransactionDTO> = {}): ActionResult<TransactionDTO> {
  return {
    ok: true,
    data: {
      id: "tx1",
      userId: "user1",
      type: "EXPENSE",
      amountCents: 1234,
      date: "2026-03-15",
      description: "Coffee",
      notes: null,
      categoryId: "cat-groceries",
      createdAt: "2026-03-15T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
      ...data,
    },
  };
}

beforeEach(() => {
  vi.mocked(createTransactionAction).mockReset();
  vi.mocked(updateTransactionAction).mockReset();
});

describe("TransactionForm", () => {
  it("keeps every entered value visible after a server validation failure", async () => {
    const user = userEvent.setup();
    vi.mocked(createTransactionAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { amount: ["Enter a valid amount, like 12.34."] },
    });
    render(<TransactionForm mode="create" categories={categories} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Amount"), "12.34");
    await user.selectOptions(screen.getByLabelText("Category"), "cat-groceries");
    await user.type(screen.getByLabelText("Description"), "Weekly shop");
    await user.type(screen.getByLabelText(/Notes/), "Bought extra snacks");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    // Both the general banner and the field-level error render as
    // role="alert" simultaneously here -- assert on the specific one.
    await waitFor(() => expect(screen.getByLabelText("Amount")).toBeInvalid());

    expect(screen.getByLabelText("Amount")).toHaveValue("12.34");
    expect(screen.getByLabelText("Category")).toHaveValue("cat-groceries");
    expect(screen.getByLabelText("Description")).toHaveValue("Weekly shop");
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Bought extra snacks");
  });

  it("places the field error beside its input, wired via aria-invalid and aria-describedby", async () => {
    const user = userEvent.setup();
    vi.mocked(createTransactionAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { amount: ["Enter a valid amount, like 12.34."] },
    });
    render(<TransactionForm mode="create" categories={categories} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Description"), "Weekly shop");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    const amountInput = screen.getByLabelText("Amount");
    await waitFor(() => expect(amountInput).toBeInvalid());
    expect(amountInput).toHaveAccessibleDescription("Enter a valid amount, like 12.34.");

    // The description field, which had no error, must not be marked invalid.
    expect(screen.getByLabelText("Description")).toBeValid();
  });

  it("calls onSuccess after a successful submission (closing/resetting the form)", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(createTransactionAction).mockResolvedValueOnce(okResult());
    render(<TransactionForm mode="create" categories={categories} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Amount"), "12.34");
    await user.selectOptions(screen.getByLabelText("Category"), "cat-groceries");
    await user.type(screen.getByLabelText("Description"), "Coffee");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("does not call onSuccess when the submission fails", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(createTransactionAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { amount: ["Enter a valid amount, like 12.34."] },
    });
    render(<TransactionForm mode="create" categories={categories} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Description"), "Coffee");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => expect(screen.getByLabelText("Amount")).toBeInvalid());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows only expense categories by default and switches to income categories when Income is selected", async () => {
    const user = userEvent.setup();
    render(<TransactionForm mode="create" categories={categories} onSuccess={vi.fn()} />);

    const categorySelect = screen.getByLabelText("Category") as HTMLSelectElement;
    let optionNames = within(categorySelect).getAllByRole("option").map((o) => o.textContent);
    expect(optionNames).toEqual(expect.arrayContaining(["Groceries", "Dining Out"]));
    expect(optionNames).not.toEqual(expect.arrayContaining(["Salary", "Freelance"]));

    await user.click(screen.getByLabelText("Income"));

    optionNames = within(categorySelect).getAllByRole("option").map((o) => o.textContent);
    expect(optionNames).toEqual(expect.arrayContaining(["Salary", "Freelance"]));
    expect(optionNames).not.toEqual(expect.arrayContaining(["Groceries", "Dining Out"]));
  });

  it("passes the transaction id through to updateBudgetAction in edit mode and preserves values on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(updateTransactionAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { description: ["Description is required."] },
    });

    const existing: TransactionDTO = {
      id: "tx-42",
      userId: "user1",
      type: "EXPENSE",
      amountCents: 5000,
      date: "2026-03-01",
      description: "Rent",
      notes: null,
      categoryId: "cat-groceries",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    };

    render(<TransactionForm mode="edit" transaction={existing} categories={categories} onSuccess={vi.fn()} />);

    expect(screen.getByLabelText("Amount")).toHaveValue("50.00");
    await user.clear(screen.getByLabelText("Description"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateTransactionAction).toHaveBeenCalled());
    expect(vi.mocked(updateTransactionAction).mock.calls[0][0]).toBe("tx-42");
    // Amount survives the failed submission unchanged.
    expect(screen.getByLabelText("Amount")).toHaveValue("50.00");
  });
});
