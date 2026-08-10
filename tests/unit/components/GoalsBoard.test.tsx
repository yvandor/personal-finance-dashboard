import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalsBoard } from "@/components/goals/GoalsBoard";
import { createSavingsGoalAction, contributeToGoalAction, deleteSavingsGoalAction } from "@/server/actions/savingsGoals";
import type { ActionResult } from "@/lib/result";
import type { SavingsGoalDTO, SavingsGoalProgressDTO } from "@/server/data/savingsGoals";

vi.mock("@/server/actions/savingsGoals", () => ({
  createSavingsGoalAction: vi.fn(),
  updateSavingsGoalAction: vi.fn(),
  deleteSavingsGoalAction: vi.fn(),
  contributeToGoalAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createSavingsGoalAction).mockReset();
  vi.mocked(contributeToGoalAction).mockReset();
  vi.mocked(deleteSavingsGoalAction).mockReset();
});

function outsideDialog(text: string) {
  return (content: string, element: Element | null) => content === text && !element?.closest("dialog");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeGoal(overrides: Partial<SavingsGoalProgressDTO> = {}): SavingsGoalProgressDTO {
  return {
    id: "g1",
    name: "Trip",
    description: null,
    targetCents: 100000,
    startingCents: 0,
    targetDate: null,
    status: "ACTIVE",
    color: "#0ea5e9",
    achievedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    currentCents: 80000,
    remainingCents: 20000,
    percentComplete: 80,
    isAchieved: false,
    pace: null,
    ...overrides,
  };
}

describe("GoalsBoard", () => {
  it("shows a new goal in the grid immediately, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<SavingsGoalDTO>>();
    vi.mocked(createSavingsGoalAction).mockReturnValueOnce(promise);

    render(<GoalsBoard goals={[]} contributionsByGoal={new Map()} currency="USD" />);
    expect(screen.getByText("No savings goals yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add goal" }));
    const dialog = screen.getByRole("dialog", { name: "Add goal" });
    await user.type(within(dialog).getByLabelText("Name"), "Emergency Fund");
    await user.type(within(dialog).getByLabelText("Target amount"), "1000.00");
    await user.click(within(dialog).getByRole("button", { name: "Add goal" }));

    await waitFor(() => expect(screen.queryByText("No savings goals yet")).not.toBeInTheDocument());
    expect(screen.getByText(outsideDialog("Emergency Fund"))).toBeInTheDocument();

    resolve({
      ok: true,
      data: {
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
      },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("updates the progress ring and pace immediately on a contribution, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<SavingsGoalProgressDTO>>();
    vi.mocked(contributeToGoalAction).mockReturnValueOnce(promise);

    render(<GoalsBoard goals={[makeGoal()]} contributionsByGoal={new Map()} currency="USD" />);
    expect(screen.getByText("80%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add contribution to Trip" }));
    const dialog = screen.getByRole("dialog", { name: "Add contribution" });
    await user.type(within(dialog).getByLabelText("Amount"), "200.00");
    await user.click(within(dialog).getByRole("button", { name: "Add contribution" }));

    // Still pending -- crossed the target (80000 + 20000 = 100000) -- the
    // goal has already moved into the collapsed Completed section before
    // the mocked action resolves.
    await waitFor(() => expect(screen.getByRole("button", { name: /Completed \(1\)/ })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Add contribution to Trip" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Completed \(1\)/ }));
    expect(screen.getByText("Goal reached")).toBeInTheDocument();

    resolve({
      ok: true,
      data: makeGoal({ currentCents: 100000, remainingCents: 0, percentComplete: 100, isAchieved: true, status: "ACHIEVED" }),
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("removes a goal from the grid immediately on delete, before the server action resolves", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<ActionResult<void>>();
    vi.mocked(deleteSavingsGoalAction).mockReturnValueOnce(promise);

    render(<GoalsBoard goals={[makeGoal()]} contributionsByGoal={new Map()} currency="USD" />);

    await user.click(screen.getByRole("button", { name: "Delete goal Trip" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByText("No savings goals yet")).toBeInTheDocument());

    resolve({ ok: true, data: undefined });
    expect(screen.getByText("No savings goals yet")).toBeInTheDocument();
  });
});
