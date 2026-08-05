import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BudgetList } from "@/components/budgets/BudgetList";
import type { BudgetProgressDTO } from "@/server/data/budgets";

// BudgetList -> BudgetCard -> BudgetFormDialog/DeleteBudgetButton import the
// real Server Actions module. Next's bundler specially compiles a "use
// server" file into a client-safe reference; plain Vite/Vitest (this
// config's react-server condition is deliberately OFF -- see
// vitest.config.components.mts) doesn't, so it would otherwise execute the
// action file directly, which imports the server-only-guarded DAL and
// throws. Mocking the actions module is the correct boundary here, the same
// way DAL tests mock @/server/context rather than hitting a real database.
vi.mock("@/server/actions/budgets", () => ({
  createBudgetAction: vi.fn(),
  updateBudgetAction: vi.fn(),
  deleteBudgetAction: vi.fn(),
}));

// Each BudgetCard also renders a closed edit-dialog whose read-only fields
// repeat the category name (e.g. "Groceries" appears both in the card's
// visible header and inside its not-yet-opened edit form). That's real
// DOM content in any environment -- a closed <dialog> is hidden via CSS,
// not removed from the tree -- so a plain getByText("Groceries") is
// legitimately ambiguous. This matcher scopes to text outside any dialog,
// i.e. what's actually visible.
function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

function makeBudget(overrides: Partial<BudgetProgressDTO> = {}): BudgetProgressDTO {
  return {
    id: "budget1",
    categoryId: "cat1",
    categoryName: "Groceries",
    month: "2026-03",
    amountCents: 30000,
    notes: null,
    // Deliberately distinct from each other and from amountCents, so
    // "spent", "remaining", and "budgeted" never collide on the same
    // formatted string within one card.
    spentCents: 20000,
    remainingCents: 10000,
    percentUsed: 67,
    isOverBudget: false,
    ...overrides,
  };
}

describe("BudgetList", () => {
  it("shows an empty-state message when there are no budgets", () => {
    render(<BudgetList budgets={[]} currency="USD" />);
    expect(screen.getByText("No budgets set for this month yet")).toBeInTheDocument();
  });

  it("renders a budget with correctly formatted currency, not raw cents", () => {
    render(<BudgetList budgets={[makeBudget()]} currency="USD" />);

    expect(screen.getByText(outsideDialog("Groceries"))).toBeInTheDocument();
    expect(screen.getByText("$200.00")).toBeInTheDocument(); // spent
    expect(screen.getByText(/\$300\.00/)).toBeInTheDocument(); // budgeted
    expect(screen.getByText("$100.00")).toBeInTheDocument(); // remaining
    expect(screen.getByText(/remaining/)).toBeInTheDocument();

    // Raw integer cents must never appear as standalone visible text.
    expect(screen.queryByText("20000")).not.toBeInTheDocument();
    expect(screen.queryByText("30000")).not.toBeInTheDocument();
    expect(screen.queryByText("10000")).not.toBeInTheDocument();
  });

  it('shows "over budget" wording (not "remaining") when spending exceeds the limit', () => {
    const overBudget = makeBudget({
      amountCents: 10000,
      spentCents: 14000,
      remainingCents: -4000,
      percentUsed: 140,
      isOverBudget: true,
    });
    render(<BudgetList budgets={[overBudget]} currency="USD" />);
    expect(screen.getByText(/over budget/)).toBeInTheDocument();
    expect(screen.queryByText(/^remaining$/)).not.toBeInTheDocument();
  });

  it("renders multiple budgets in a different currency", () => {
    render(
      <BudgetList
        budgets={[
          makeBudget({ id: "b1", categoryName: "Groceries" }),
          makeBudget({ id: "b2", categoryName: "Dining", amountCents: 10000, spentCents: 2000, remainingCents: 8000 }),
        ]}
        currency="EUR"
      />,
    );
    expect(screen.getByText(outsideDialog("Groceries"))).toBeInTheDocument();
    expect(screen.getByText(outsideDialog("Dining"))).toBeInTheDocument();
    expect(screen.getAllByText(/€/).length).toBeGreaterThan(0);
  });
});
