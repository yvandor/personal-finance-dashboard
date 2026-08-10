import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

const categories: CategoryDTO[] = [{ id: "cat1", type: "EXPENSE", name: "Groceries", color: "#000000" }];

function makeTransaction(overrides: Partial<TransactionDTO> = {}): TransactionDTO {
  return {
    id: "tx1",
    userId: "user1",
    type: "EXPENSE",
    amountCents: 2500,
    date: "2026-03-15",
    description: "Whole Foods",
    notes: null,
    categoryId: "cat1",
    incomeSourceId: null,
    createdAt: "2026-03-15T00:00:00.000Z",
    updatedAt: "2026-03-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("RecentTransactions", () => {
  it("shows an empty-state message with a link to add a transaction", () => {
    render(<RecentTransactions transactions={[]} categories={categories} currency="USD" />);
    expect(screen.getByText(/No transactions yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add your first one/ })).toHaveAttribute("href", "/transactions");
  });

  it("renders each transaction with its category, date, and formatted amount", () => {
    const transactions = [makeTransaction()];
    render(<RecentTransactions transactions={transactions} categories={categories} currency="USD" />);

    expect(screen.getByText("Whole Foods")).toBeInTheDocument();
    expect(screen.getByText(/Groceries/)).toBeInTheDocument();
    expect(screen.getByText(/2026-03-15/)).toBeInTheDocument();
    expect(screen.getByText("-$25.00")).toBeInTheDocument();
    expect(screen.queryByText("2500")).not.toBeInTheDocument();
  });

  it('labels a transaction with no category as "Uncategorized"', () => {
    const transactions = [makeTransaction({ categoryId: null })];
    render(<RecentTransactions transactions={transactions} categories={categories} currency="USD" />);
    expect(screen.getByText(/Uncategorized/)).toBeInTheDocument();
  });

  it('always links to the full transaction page via "View all transactions"', () => {
    render(<RecentTransactions transactions={[makeTransaction()]} categories={categories} currency="USD" />);
    expect(screen.getByRole("link", { name: "View all transactions" })).toHaveAttribute("href", "/transactions");
  });
});
