import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillsBoard } from "@/components/bills/BillsBoard";
import { createRecurringBillAction, archiveRecurringBillAction } from "@/server/actions/recurringBills";
import type { ActionResult } from "@/lib/result";
import type { RecurringBillDTO, RecurringBillWithStatusDTO } from "@/server/data/recurringBills";

vi.mock("@/server/actions/recurringBills", () => ({
  createRecurringBillAction: vi.fn(),
  updateRecurringBillAction: vi.fn(),
  archiveRecurringBillAction: vi.fn(),
  unarchiveRecurringBillAction: vi.fn(),
  markBillPaidAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createRecurringBillAction).mockReset();
  vi.mocked(archiveRecurringBillAction).mockReset();
});

function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeBill(overrides: Partial<RecurringBillWithStatusDTO> = {}): RecurringBillWithStatusDTO {
  return {
    id: "b1",
    name: "Rent",
    amountCents: 150000,
    dueDay: 1,
    categoryId: null,
    categoryName: null,
    isActive: true,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isPaidThisMonth: false,
    status: "UPCOMING",
    dueDate: "2026-03-01",
    daysUntilDue: 10,
    ...overrides,
  };
}

describe("BillsBoard", () => {
  it("shows a new bill in the list immediately, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<RecurringBillDTO>>();
    vi.mocked(createRecurringBillAction).mockReturnValueOnce(promise);

    render(<BillsBoard bills={[]} categories={[]} periodMonth="2026-03" />);
    expect(screen.getByText("No bills yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add bill" }));
    const dialog = screen.getByRole("dialog", { name: "Add bill" });
    await user.type(within(dialog).getByLabelText("Name"), "Internet");
    await user.type(within(dialog).getByLabelText("Amount"), "59.99");
    await user.click(within(dialog).getByRole("button", { name: "Add bill" }));

    // Still pending -- the mocked action hasn't resolved -- yet the row is already visible.
    await waitFor(() => expect(screen.queryByText("No bills yet")).not.toBeInTheDocument());
    expect(screen.getByText(outsideDialog("Internet"))).toBeInTheDocument();

    resolve({
      ok: true,
      data: {
        id: "b1",
        name: "Internet",
        amountCents: 5999,
        dueDay: 1,
        categoryId: null,
        categoryName: null,
        isActive: true,
        notes: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("reverts the optimistic row if the create action fails", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<RecurringBillDTO>>();
    vi.mocked(createRecurringBillAction).mockReturnValueOnce(promise);

    render(<BillsBoard bills={[]} categories={[]} periodMonth="2026-03" />);

    await user.click(screen.getByRole("button", { name: "Add bill" }));
    const dialog = screen.getByRole("dialog", { name: "Add bill" });
    await user.type(within(dialog).getByLabelText("Name"), "Internet");
    await user.type(within(dialog).getByLabelText("Amount"), "59.99");
    await user.click(within(dialog).getByRole("button", { name: "Add bill" }));

    await waitFor(() => expect(screen.queryByText("No bills yet")).not.toBeInTheDocument());

    resolve({ ok: false, error: "A recurring bill with this name already exists." });

    await waitFor(() => expect(screen.getByText("No bills yet")).toBeInTheDocument());
  });

  it("moves a bill into the Archived section immediately on archive, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<void>>();
    vi.mocked(archiveRecurringBillAction).mockReturnValueOnce(promise);

    const bills = [makeBill({ id: "b1", name: "Rent" })];
    render(<BillsBoard bills={bills} categories={[]} periodMonth="2026-03" />);

    await user.click(screen.getByRole("button", { name: "Archive Rent" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Archived" })).toBeInTheDocument();

    resolve({ ok: true, data: undefined });
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("offers a Mark paid trigger only for an active, unpaid bill", () => {
    const bills = [
      makeBill({ id: "b1", name: "Rent", isPaidThisMonth: false, isActive: true }),
      makeBill({ id: "b2", name: "Water", isPaidThisMonth: true, isActive: true }),
      makeBill({ id: "b3", name: "Old Gym", isPaidThisMonth: false, isActive: false }),
    ];
    render(<BillsBoard bills={bills} categories={[]} periodMonth="2026-03" />);

    expect(screen.getByRole("button", { name: "Mark Rent paid" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Water paid" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Old Gym paid" })).not.toBeInTheDocument();
  });
});
