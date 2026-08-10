import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionsBoard } from "@/components/transactions/TransactionsBoard";
import { createTransactionAction } from "@/server/actions/transactions";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { ActionResult } from "@/lib/result";
import type { CategoryDTO } from "@/server/data/categories";
import type { TransactionDTO } from "@/server/data/transactions";
import type { ReactElement } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/transactions",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/server/actions/transactions", () => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  deleteTransactionAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createTransactionAction).mockReset();
});

const categories: CategoryDTO[] = [{ id: "cat-groceries", type: "EXPENSE", name: "Groceries", color: "#000" }];

const emptySummary = { incomeCents: 0, expenseCents: 0, netCents: 0, count: 0 };
const emptyPager = { total: 0, hasNext: false, hasPrev: false, nextCursor: null, prevCursor: null, searchParams: {} };

function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

// TransactionsBoard's DeleteTransactionButton descendant calls useToast(),
// which throws outside a ToastProvider -- the real app provides this from
// app/(dashboard)/layout.tsx.
function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

async function fillAndSubmitCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add transaction" }));
  const dialog = screen.getByRole("dialog", { name: "Add transaction" });
  await user.type(within(dialog).getByLabelText("Amount"), "42.00");
  await user.type(within(dialog).getByLabelText("Description"), "Snacks");
  await user.selectOptions(within(dialog).getByLabelText("Category"), "cat-groceries");
  await user.click(within(dialog).getByRole("button", { name: "Add transaction" }));
}

describe("TransactionsBoard", () => {
  it("shows a new transaction in the list immediately on the default view, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<TransactionDTO>>();
    vi.mocked(createTransactionAction).mockReturnValueOnce(promise);

    renderWithToast(
      <TransactionsBoard
        transactions={[]}
        categories={categories}
        currency="USD"
        hasActiveFilters={false}
        summary={emptySummary}
        pager={emptyPager}
        isDefaultView={true}
      />,
    );
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();

    await fillAndSubmitCreateForm(user);

    // Still pending -- the mocked action hasn't resolved -- yet the row is already visible.
    await waitFor(() => expect(screen.queryByText("No transactions yet")).not.toBeInTheDocument());
    expect(screen.getAllByText(outsideDialog("Snacks")).length).toBeGreaterThan(0);

    resolve({
      ok: true,
      data: {
        id: "tx1",
        userId: "u1",
        type: "EXPENSE",
        amountCents: 4200,
        date: "2026-03-15",
        description: "Snacks",
        notes: null,
        categoryId: "cat-groceries",
        incomeSourceId: null,
        createdAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-15T00:00:00.000Z",
      },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not optimistically insert outside the default view (a filter is active)", async () => {
    const user = userEvent.setup();
    const { promise } = deferred<ActionResult<TransactionDTO>>();
    vi.mocked(createTransactionAction).mockReturnValueOnce(promise);

    renderWithToast(
      <TransactionsBoard
        transactions={[]}
        categories={categories}
        currency="USD"
        hasActiveFilters={true}
        summary={emptySummary}
        pager={emptyPager}
        isDefaultView={false}
      />,
    );

    await fillAndSubmitCreateForm(user);

    // Still pending, and no filter-scoped optimistic insert was attempted --
    // the empty state (filtered wording) is still showing.
    expect(screen.getByText("No transactions match these filters")).toBeInTheDocument();
  });

  it("removes a transaction from the list immediately on delete confirm (the real delete waits behind the undo toast)", async () => {
    const user = userEvent.setup();

    const transactions: TransactionDTO[] = [
      {
        id: "tx1",
        userId: "u1",
        type: "EXPENSE",
        amountCents: 1000,
        date: "2026-03-10",
        description: "Coffee",
        notes: null,
        categoryId: "cat-groceries",
        incomeSourceId: null,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z",
      },
    ];
    renderWithToast(
      <TransactionsBoard
        transactions={transactions}
        categories={categories}
        currency="USD"
        hasActiveFilters={false}
        summary={emptySummary}
        pager={emptyPager}
        isDefaultView={true}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    const confirmDialog = screen.getByRole("dialog", { name: "Delete transaction?" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Delete" }));

    // Removed immediately -- the row is gone well before
    // DeleteTransactionButton's undo window (5s default) would have
    // elapsed. The full undo/commit cycle itself is covered by
    // tests/unit/components/DeleteTransactionButton.test.tsx.
    await waitFor(() => expect(screen.getByText("No transactions yet")).toBeInTheDocument());
  });

  it("updates SummaryCards' totals immediately on delete, not just the row list", async () => {
    const user = userEvent.setup();

    const transactions: TransactionDTO[] = [
      {
        id: "tx1",
        userId: "u1",
        type: "EXPENSE",
        amountCents: 1000,
        date: "2026-03-10",
        description: "Coffee",
        notes: null,
        categoryId: "cat-groceries",
        incomeSourceId: null,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z",
      },
    ];
    // A non-empty base summary this list's own total wouldn't otherwise
    // prove: expenseCents is deliberately > the one row's amount, and
    // incomeCents is nonzero so the Expenses/Net cards never coincide, so a
    // *correct* delta-adjustment (not "recomputed from what's on screen")
    // is what makes this assertion pass.
    const summary = { incomeCents: 2000, expenseCents: 5000, netCents: -3000, count: 3 };
    renderWithToast(
      <TransactionsBoard
        transactions={transactions}
        categories={categories}
        currency="USD"
        hasActiveFilters={false}
        summary={summary}
        pager={emptyPager}
        isDefaultView={true}
      />,
    );
    expect(screen.getByText("-$50.00")).toBeInTheDocument(); // expenses card

    await user.click(screen.getByRole("button", { name: "Delete Coffee" }));
    const confirmDialog = screen.getByRole("dialog", { name: "Delete transaction?" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Delete" }));

    // 5000 - 1000 = 4000 expense, net 2000 - 4000 = -2000 -- updated before
    // the real delete (deferred behind the undo toast) ever resolves.
    await waitFor(() => expect(screen.getByText("-$40.00")).toBeInTheDocument());
    expect(screen.getByText("-$20.00")).toBeInTheDocument();
  });
});
