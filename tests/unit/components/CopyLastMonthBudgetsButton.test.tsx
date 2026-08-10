import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyLastMonthBudgetsButton } from "@/components/budgets/CopyLastMonthBudgetsButton";
import { copyBudgetsFromMonthAction } from "@/server/actions/budgets";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { ReactElement } from "react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/server/actions/budgets", () => ({
  copyBudgetsFromMonthAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(copyBudgetsFromMonthAction).mockReset();
  refresh.mockReset();
});

// CopyLastMonthBudgetsButton calls useToast(), which throws outside a
// ToastProvider -- same reasoning as other board component tests.
function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("CopyLastMonthBudgetsButton", () => {
  it("derives fromMonth as the month before the given month", async () => {
    const user = userEvent.setup();
    vi.mocked(copyBudgetsFromMonthAction).mockResolvedValueOnce({
      ok: true,
      data: { copiedCount: 2, skippedCount: 0 },
    });
    renderWithToast(<CopyLastMonthBudgetsButton month="2026-03" />);

    await user.click(screen.getByRole("button", { name: "Copy last month's budgets" }));

    await waitFor(() => expect(copyBudgetsFromMonthAction).toHaveBeenCalledTimes(1));
    expect(copyBudgetsFromMonthAction).toHaveBeenCalledWith({ fromMonth: "2026-02", toMonth: "2026-03" }, null);
  });

  it("shows a summary toast and refreshes on success", async () => {
    const user = userEvent.setup();
    vi.mocked(copyBudgetsFromMonthAction).mockResolvedValueOnce({
      ok: true,
      data: { copiedCount: 2, skippedCount: 1 },
    });
    renderWithToast(<CopyLastMonthBudgetsButton month="2026-03" />);

    await user.click(screen.getByRole("button", { name: "Copy last month's budgets" }));

    await waitFor(() => expect(screen.getByText(/Copied 2 budgets from last month/)).toBeInTheDocument());
    expect(screen.getByText(/1 already budgeted this month, skipped/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the error message and does not refresh on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(copyBudgetsFromMonthAction).mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    renderWithToast(<CopyLastMonthBudgetsButton month="2026-03" />);

    await user.click(screen.getByRole("button", { name: "Copy last month's budgets" }));

    await waitFor(() =>
      expect(screen.getByText(/Couldn't copy last month's budgets: Something went wrong\./)).toBeInTheDocument(),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
