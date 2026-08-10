import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoriesBoard } from "@/components/categories/CategoriesBoard";
import { createCategoryAction, archiveCategoryAction } from "@/server/actions/categories";
import type { ActionResult } from "@/lib/result";
import type { CategoryDTO, CategoryManagementDTO } from "@/server/data/categories";

vi.mock("@/server/actions/categories", () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
  archiveCategoryAction: vi.fn(),
  unarchiveCategoryAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createCategoryAction).mockReset();
  vi.mocked(archiveCategoryAction).mockReset();
});

function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("CategoriesBoard", () => {
  it("shows a new category in the list immediately, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<CategoryDTO>>();
    vi.mocked(createCategoryAction).mockReturnValueOnce(promise);

    render(<CategoriesBoard categories={[]} />);
    expect(screen.getByText("No categories yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add category" }));
    const dialog = screen.getByRole("dialog", { name: "Add category" });
    await user.type(within(dialog).getByLabelText("Name"), "Hobbies");
    await user.click(within(dialog).getByRole("button", { name: "Add category" }));

    // Still pending -- the mocked action hasn't resolved -- yet the row is already visible.
    await waitFor(() => expect(screen.queryByText("No categories yet")).not.toBeInTheDocument());
    expect(screen.getByText(outsideDialog("Hobbies"))).toBeInTheDocument();
    expect(screen.getByText("Not currently in use")).toBeInTheDocument();

    resolve({ ok: true, data: { id: "c1", type: "EXPENSE", name: "Hobbies", color: "#64748b" } });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("reverts the optimistic row if the create action fails", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<CategoryDTO>>();
    vi.mocked(createCategoryAction).mockReturnValueOnce(promise);

    render(<CategoriesBoard categories={[]} />);

    await user.click(screen.getByRole("button", { name: "Add category" }));
    const dialog = screen.getByRole("dialog", { name: "Add category" });
    await user.type(within(dialog).getByLabelText("Name"), "Hobbies");
    await user.click(within(dialog).getByRole("button", { name: "Add category" }));

    await waitFor(() => expect(screen.queryByText("No categories yet")).not.toBeInTheDocument());

    resolve({ ok: false, error: "A category with this name already exists." });

    await waitFor(() => expect(screen.getByText("No categories yet")).toBeInTheDocument());
  });

  it("moves a category into the Archived section immediately on archive, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<void>>();
    vi.mocked(archiveCategoryAction).mockReturnValueOnce(promise);

    const categories: CategoryManagementDTO[] = [
      { id: "c1", type: "EXPENSE", name: "Groceries", color: "#000", isArchived: false, isSystem: false, transactionCount: 0 },
    ];
    render(<CategoriesBoard categories={categories} />);

    await user.click(screen.getByRole("button", { name: "Archive Groceries" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument());

    resolve({ ok: true, data: undefined });
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });
});
