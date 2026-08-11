import { listSavingsGoals, listAllContributions } from "@/server/data/savingsGoals";
import { getCurrentUserCurrency } from "@/server/data/users";
import { groupContributionsByGoal } from "@/lib/savingsGoals";
import { GoalsBoard } from "@/components/goals/GoalsBoard";

// A Server Component: reads directly through the DAL, no Server Action
// needed for the read itself. Hands the results to GoalsBoard (a client
// component), which owns the useOptimistic overlay shared by the header's
// create dialog and the grid below it. Writes go through
// server/actions/savingsGoals.ts.
//
// force-dynamic (v1.4): see app/(dashboard)/categories/page.tsx's comment --
// this page was statically prerendered and served with a one-year shared
// cache lifetime despite reading live goal/contribution data, found via a
// real production-server header check.
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const [goals, contributions, currency] = await Promise.all([
    listSavingsGoals(),
    listAllContributions(),
    getCurrentUserCurrency(),
  ]);
  const contributionsByGoal = groupContributionsByGoal(contributions);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <GoalsBoard goals={goals} contributionsByGoal={contributionsByGoal} currency={currency} />
    </div>
  );
}
