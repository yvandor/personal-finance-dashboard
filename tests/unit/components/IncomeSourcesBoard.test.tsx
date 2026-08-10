import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IncomeSourcesBoard } from "@/components/income/IncomeSourcesBoard";
import { createIncomeSourceAction, archiveIncomeSourceAction } from "@/server/actions/incomeSources";
import type { ActionResult } from "@/lib/result";
import type { IncomeSourceDTO, IncomeSourceManagementDTO } from "@/server/data/incomeSources";
import type { IncomeVsExpectedDTO } from "@/lib/incomeSources";

vi.mock("@/server/actions/incomeSources", () => ({
  createIncomeSourceAction: vi.fn(),
  updateIncomeSourceAction: vi.fn(),
  archiveIncomeSourceAction: vi.fn(),
  unarchiveIncomeSourceAction: vi.fn(),
}));

// next/navigation is used by components/income/MonthSelector.tsx --
// same mocking approach as tests/unit/components/BudgetsBoard.test.tsx for
// its MonthSelector.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/income",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  vi.mocked(createIncomeSourceAction).mockReset();
  vi.mocked(archiveIncomeSourceAction).mockReset();
});

function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function emptyIncomeVsExpected(month = "2026-03"): IncomeVsExpectedDTO {
  return { month, sources: [], unattributedCents: 0, totalExpectedCents: 0, totalActualCents: 0 };
}

describe("IncomeSourcesBoard", () => {
  it("shows a new income source in the list immediately, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<IncomeSourceDTO>>();
    vi.mocked(createIncomeSourceAction).mockReturnValueOnce(promise);

    render(<IncomeSourcesBoard incomeSources={[]} incomeVsExpected={emptyIncomeVsExpected()} month="2026-03" />);
    expect(screen.getByText("No income sources yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add income source" }));
    const dialog = screen.getByRole("dialog", { name: "Add income source" });
    await user.type(within(dialog).getByLabelText("Name"), "Paycheck");
    await user.type(within(dialog).getByLabelText("Expected amount"), "2500.00");
    await user.clear(within(dialog).getByLabelText("Pay day"));
    await user.type(within(dialog).getByLabelText("Pay day"), "15");
    await user.click(within(dialog).getByRole("button", { name: "Add income source" }));

    // Still pending -- the mocked action hasn't resolved -- yet the row is already visible.
    await waitFor(() => expect(screen.queryByText("No income sources yet")).not.toBeInTheDocument());
    expect(screen.getByText(outsideDialog("Paycheck"))).toBeInTheDocument();
    expect(screen.getByText("Not currently in use")).toBeInTheDocument();

    resolve({
      ok: true,
      data: { id: "s1", name: "Paycheck", amountCents: 250000, payDay: 15, notes: null },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("reverts the optimistic row if the create action fails", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<IncomeSourceDTO>>();
    vi.mocked(createIncomeSourceAction).mockReturnValueOnce(promise);

    render(<IncomeSourcesBoard incomeSources={[]} incomeVsExpected={emptyIncomeVsExpected()} month="2026-03" />);

    await user.click(screen.getByRole("button", { name: "Add income source" }));
    const dialog = screen.getByRole("dialog", { name: "Add income source" });
    await user.type(within(dialog).getByLabelText("Name"), "Paycheck");
    await user.type(within(dialog).getByLabelText("Expected amount"), "2500.00");
    await user.click(within(dialog).getByRole("button", { name: "Add income source" }));

    await waitFor(() => expect(screen.queryByText("No income sources yet")).not.toBeInTheDocument());

    resolve({ ok: false, error: "An income source with this name already exists." });

    await waitFor(() => expect(screen.getByText("No income sources yet")).toBeInTheDocument());
  });

  it("moves a source into the Archived section immediately on archive, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<void>>();
    vi.mocked(archiveIncomeSourceAction).mockReturnValueOnce(promise);

    const incomeSources: IncomeSourceManagementDTO[] = [
      { id: "s1", name: "Paycheck", amountCents: 250000, payDay: 15, notes: null, isActive: true, transactionCount: 0 },
    ];
    render(
      <IncomeSourcesBoard incomeSources={incomeSources} incomeVsExpected={emptyIncomeVsExpected()} month="2026-03" />,
    );

    await user.click(screen.getByRole("button", { name: "Archive Paycheck" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument());

    resolve({ ok: true, data: undefined });
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("renders the month's expected-vs-received summary for each active source", () => {
    const incomeVsExpected: IncomeVsExpectedDTO = {
      month: "2026-03",
      sources: [{ id: "s1", name: "Paycheck", expectedCents: 250000, actualCents: 250000 }],
      unattributedCents: 5000,
      totalExpectedCents: 250000,
      totalActualCents: 255000,
    };
    render(<IncomeSourcesBoard incomeSources={[]} incomeVsExpected={incomeVsExpected} month="2026-03" />);

    expect(screen.getByText(outsideDialog("Paycheck"))).toBeInTheDocument();
    expect(screen.getByText(/wasn't tagged to any income source/)).toBeInTheDocument();
  });
});
