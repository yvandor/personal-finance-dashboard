import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryList } from "@/components/categories/CategoryList";
import type { CategoryManagementDTO } from "@/server/data/categories";

// CategoryList -> CategoryRow -> CategoryFormDialog/ArchiveCategoryButton
// import the real Server Actions module -- same reasoning as
// BudgetList.test.tsx's comment on why this boundary is mocked rather than
// the react-server condition being enabled.
vi.mock("@/server/actions/categories", () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
  archiveCategoryAction: vi.fn(),
  unarchiveCategoryAction: vi.fn(),
}));

function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

function makeCategory(overrides: Partial<CategoryManagementDTO> = {}): CategoryManagementDTO {
  return {
    id: "c1",
    type: "EXPENSE",
    name: "Groceries",
    color: "#64748b",
    isArchived: false,
    isSystem: false,
    transactionCount: 0,
    ...overrides,
  };
}

describe("CategoryList", () => {
  it("shows an empty-state message when there are no categories", () => {
    render(<CategoryList categories={[]} />);
    expect(screen.getByText("No categories yet")).toBeInTheDocument();
  });

  it("groups active categories under Income/Expense section headings", () => {
    render(
      <CategoryList
        categories={[
          makeCategory({ id: "c1", type: "EXPENSE", name: "Groceries" }),
          makeCategory({ id: "c2", type: "INCOME", name: "Salary" }),
        ]}
      />,
    );
    expect(screen.getByText("Income categories")).toBeInTheDocument();
    expect(screen.getByText("Expense categories")).toBeInTheDocument();
    expect(screen.getByText(outsideDialog("Groceries"))).toBeInTheDocument();
    expect(screen.getByText(outsideDialog("Salary"))).toBeInTheDocument();
  });

  it("shows archived categories under a separate Archived heading", () => {
    render(
      <CategoryList
        categories={[
          makeCategory({ id: "c1", name: "Active One" }),
          makeCategory({ id: "c2", name: "Old One", isArchived: true }),
        ]}
      />,
    );
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText(outsideDialog("Old One"))).toBeInTheDocument();
  });

  it("omits a section heading entirely when it has no categories", () => {
    render(<CategoryList categories={[makeCategory({ type: "EXPENSE" })]} />);
    expect(screen.queryByText("Income categories")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it('shows "Not currently in use" for a category with zero transactions', () => {
    render(<CategoryList categories={[makeCategory({ transactionCount: 0 })]} />);
    expect(screen.getByText("Not currently in use")).toBeInTheDocument();
  });

  it("shows a singular/plural transaction count correctly", () => {
    render(
      <CategoryList
        categories={[
          makeCategory({ id: "c1", name: "One", transactionCount: 1 }),
          makeCategory({ id: "c2", name: "Many", transactionCount: 5 }),
        ]}
      />,
    );
    expect(screen.getByText("1 transaction")).toBeInTheDocument();
    expect(screen.getByText("5 transactions")).toBeInTheDocument();
  });

  it("marks a system (seeded) category as Default", () => {
    render(<CategoryList categories={[makeCategory({ isSystem: true })]} />);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("does not show an Edit button for an archived category", () => {
    render(<CategoryList categories={[makeCategory({ name: "Old One", isArchived: true })]} />);
    expect(screen.queryByRole("button", { name: "Edit Old One" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });
});
