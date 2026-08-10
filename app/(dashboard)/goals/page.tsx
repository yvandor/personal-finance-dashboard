import { listSavingsGoals, listAllContributions } from "@/server/data/savingsGoals";
import { getCurrentUserCurrency } from "@/server/data/users";
import { groupContributionsByGoal } from "@/lib/savingsGoals";
import { GoalGrid } from "@/components/goals/GoalGrid";
import { GoalFormDialog } from "@/components/goals/GoalFormDialog";

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// A Server Component: reads directly through the DAL, no Server Action
// needed for the read itself. Writes go through server/actions/savingsGoals.ts.
export default async function GoalsPage() {
  const [goals, contributions, currency] = await Promise.all([
    listSavingsGoals(),
    listAllContributions(),
    getCurrentUserCurrency(),
  ]);
  const contributionsByGoal = groupContributionsByGoal(contributions);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Savings Goals</h1>
          <p className="text-sm text-muted">
            Track progress toward a target. Contributions are independent of your transaction ledger.
          </p>
        </div>
        <GoalFormDialog mode="create" triggerClassName={PRIMARY_BUTTON_CLASSES}>
          Add goal
        </GoalFormDialog>
      </div>

      <GoalGrid goals={goals} contributionsByGoal={contributionsByGoal} currency={currency} />
    </div>
  );
}
