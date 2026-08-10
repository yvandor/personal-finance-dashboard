import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryForm } from "@/components/categories/CategoryForm";
import { createCategoryAction, updateCategoryAction } from "@/server/actions/categories";

// Server Actions are the external boundary -- same reasoning as BudgetForm.test.tsx.
vi.mock("@/server/actions/categories", () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createCategoryAction).mockReset();
  vi.mocked(updateCategoryAction).mockReset();
});

describe("CategoryForm", () => {
  it("keeps entered values visible after a server validation failure", async () => {
    const user = userEvent.setup();
    vi.mocked(createCategoryAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { name: ["A category with this name already exists."] },
    });
    render(<CategoryForm mode="create" onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Groceries");
    await user.click(screen.getByLabelText("Income"));
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() => expect(screen.getByLabelText("Name")).toBeInvalid());
    expect(screen.getByLabelText("Name")).toHaveValue("Groceries");
    expect(screen.getByLabelText("Income")).toBeChecked();
  });

  it("wires the field error to the input via aria-invalid and aria-describedby", async () => {
    const user = userEvent.setup();
    vi.mocked(createCategoryAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { name: ["A category with this name already exists."] },
    });
    render(<CategoryForm mode="create" onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Groceries");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    const nameInput = screen.getByLabelText("Name");
    await waitFor(() => expect(nameInput).toBeInvalid());
    expect(nameInput).toHaveAccessibleDescription("A category with this name already exists.");
  });

  it("calls onSuccess after a successful submission", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(createCategoryAction).mockResolvedValueOnce({
      ok: true,
      data: { id: "c1", type: "EXPENSE", name: "Groceries", color: "#64748b" },
    });
    render(<CategoryForm mode="create" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Name"), "Groceries");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("shows the type as read-only text (not radio inputs) in edit mode, and preserves the name on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(updateCategoryAction).mockResolvedValueOnce({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { name: ["A category with this name already exists."] },
    });
    const category = { id: "c1", type: "EXPENSE" as const, name: "Groceries", color: "#64748b" };
    render(<CategoryForm mode="edit" category={category} onSuccess={vi.fn()} />);

    expect(screen.getByText(/Expense/)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Groceries");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeInvalid());
    expect(screen.getByLabelText("Name")).toHaveValue("Groceries");

    expect(vi.mocked(updateCategoryAction).mock.calls[0][0]).toBe("c1");
  });
});
