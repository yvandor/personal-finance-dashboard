import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalGrid } from "@/components/goals/GoalGrid";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { SavingsGoalProgressDTO, ContributionDTO } from "@/server/data/savingsGoals";
import type { ReactElement } from "react";

// GoalGrid -> GoalCard -> GoalFormDialog/ContributionFormDialog/DeleteGoalButton
// import the real Server Actions module -- same reasoning as
// BudgetList.test.tsx's comment on why this boundary is mocked.
vi.mock("@/server/actions/savingsGoals", () => ({
  createSavingsGoalAction: vi.fn(),
  updateSavingsGoalAction: vi.fn(),
  deleteSavingsGoalAction: vi.fn(),
  contributeToGoalAction: vi.fn(),
}));

function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

function makeGoal(overrides: Partial<SavingsGoalProgressDTO> = {}): SavingsGoalProgressDTO {
  return {
    id: "g1",
    name: "Emergency Fund",
    description: null,
    targetCents: 100000,
    startingCents: 0,
    targetDate: null,
    status: "ACTIVE",
    color: "#0ea5e9",
    achievedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    currentCents: 30000,
    remainingCents: 70000,
    percentComplete: 30,
    isAchieved: false,
    pace: null,
    ...overrides,
  };
}

// GoalCard -> DeleteGoalButton calls useToast(), which throws outside a ToastProvider.
function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("GoalGrid", () => {
  it("shows an empty-state message when there are no goals", () => {
    renderWithToast(<GoalGrid goals={[]} contributionsByGoal={new Map()} currency="USD" />);
    expect(screen.getByText("No savings goals yet")).toBeInTheDocument();
  });

  it("renders an active goal with correctly formatted currency, not raw cents", () => {
    renderWithToast(<GoalGrid goals={[makeGoal()]} contributionsByGoal={new Map()} currency="USD" />);
    expect(screen.getByText(outsideDialog("Emergency Fund"))).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument(); // current
    expect(screen.getByText(/\$1,000\.00/)).toBeInTheDocument(); // target
    expect(screen.queryByText("30000")).not.toBeInTheDocument();
  });

  it("puts an achieved goal under a collapsed Completed section, not the active grid", () => {
    renderWithToast(
      <GoalGrid
        goals={[makeGoal({ id: "g1", name: "Active One" }), makeGoal({ id: "g2", name: "Done One", isAchieved: true, status: "ACHIEVED" })]}
        contributionsByGoal={new Map()}
        currency="USD"
      />,
    );
    expect(screen.getByText(outsideDialog("Active One"))).toBeInTheDocument();
    expect(screen.queryByText(outsideDialog("Done One"))).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Completed \(1\)/ })).toBeInTheDocument();
  });

  it("omits the Completed section entirely when no goal is achieved", () => {
    renderWithToast(<GoalGrid goals={[makeGoal()]} contributionsByGoal={new Map()} currency="USD" />);
    expect(screen.queryByRole("button", { name: /Completed/ })).not.toBeInTheDocument();
  });

  it("passes each goal's own contribution history through", async () => {
    const user = userEvent.setup();
    const contributions: ContributionDTO[] = [
      { id: "c1", goalId: "g1", amountCents: 5000, date: "2026-01-05", note: "Bonus", createdAt: "2026-01-05T00:00:00.000Z" },
    ];
    renderWithToast(
      <GoalGrid
        goals={[makeGoal({ id: "g1" })]}
        contributionsByGoal={new Map([["g1", contributions]])}
        currency="USD"
      />,
    );
    await user.click(screen.getByRole("button", { name: "History (1)" }));
    expect(screen.getByText(/Bonus/)).toBeInTheDocument();
  });
});
