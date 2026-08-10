import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetsBoard } from "@/components/budgets/BudgetsBoard";
import { createBudgetAction, deleteBudgetAction } from "@/server/actions/budgets";
import type { CategoryDTO } from "@/server/data/categories";
import type { ActionResult } from "@/lib/result";
import type { BudgetDTO } from "@/server/data/budgets";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/budgets",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/server/actions/budgets", () => ({
  createBudgetAction: vi.fn(),
  updateBudgetAction: vi.fn(),
  deleteBudgetAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createBudgetAction).mockReset();
  vi.mocked(deleteBudgetAction).mockReset();
});

const categories: CategoryDTO[] = [{ id: "cat-groceries", type: "EXPENSE", name: "Groceries", color: "#000" }];

function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

// Deferred so the test controls exactly when the mocked Server Action
// settles, proving the row appears BEFORE that resolution -- true
// optimism, not just "the list updates quickly."
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function openCreateDialogAndFill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add budget" }));
  const dialog = screen.getByRole("dialog", { name: "Add budget" });
  await user.selectOptions(within(dialog).getByLabelText("Category"), "cat-groceries");
  await user.type(within(dialog).getByLabelText("Monthly limit"), "300.00");
  await user.click(within(dialog).getByRole("button", { name: "Add budget" }));
}

describe("BudgetsBoard", () => {
  it("shows a new budget in the list immediately, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<BudgetDTO>>();
    vi.mocked(createBudgetAction).mockReturnValueOnce(promise);

    render(<BudgetsBoard budgets={[]} availableCategories={categories} month="2026-03" currency="USD" />);
    expect(screen.getByText("No budgets set for this month yet")).toBeInTheDocument();

    await openCreateDialogAndFill(user);

    // Still pending -- the mocked action hasn't resolved -- yet the row is already visible.
    await waitFor(() => expect(screen.queryByText("No budgets set for this month yet")).not.toBeInTheDocument());
    expect(screen.getByText(outsideDialog("Groceries"))).toBeInTheDocument();

    resolve({
      ok: true,
      data: {
        id: "b1",
        categoryId: "cat-groceries",
        categoryName: "Groceries",
        month: "2026-03",
        amountCents: 30000,
        notes: null,
      },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("reverts the optimistic row if the create action fails", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<BudgetDTO>>();
    vi.mocked(createBudgetAction).mockReturnValueOnce(promise);

    render(<BudgetsBoard budgets={[]} availableCategories={categories} month="2026-03" currency="USD" />);

    await openCreateDialogAndFill(user);
    await waitFor(() => expect(screen.queryByText("No budgets set for this month yet")).not.toBeInTheDocument());

    resolve({ ok: false, error: "A budget for this category already exists this month." });

    await waitFor(() => expect(screen.getByText("No budgets set for this month yet")).toBeInTheDocument());
  });

  it("removes a budget from the list immediately on delete, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<void>>();
    vi.mocked(deleteBudgetAction).mockReturnValueOnce(promise);

    const budgets = [
      {
        id: "b1",
        categoryId: "cat-groceries",
        categoryName: "Groceries",
        month: "2026-03",
        amountCents: 30000,
        notes: null,
        spentCents: 10000,
        remainingCents: 20000,
        percentUsed: 33,
        isOverBudget: false,
      },
    ];
    render(<BudgetsBoard budgets={budgets} availableCategories={[]} month="2026-03" currency="USD" />);

    await user.click(screen.getByRole("button", { name: "Delete budget for Groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // Still pending -- the mocked action hasn't resolved -- yet the row is already gone.
    await waitFor(() => expect(screen.getByText("No budgets set for this month yet")).toBeInTheDocument());

    resolve({ ok: true, data: undefined });
    // Stays gone once the (successful) real delete settles too.
    expect(screen.getByText("No budgets set for this month yet")).toBeInTheDocument();
  });
});
