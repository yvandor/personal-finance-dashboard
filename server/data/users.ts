import "server-only";
import { cache } from "react";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";

// Falls back to "USD" if the user row doesn't exist yet rather than
// throwing -- this can run on a freshly-migrated, not-yet-seeded database
// (e.g. the transactions page's first load), and a missing display
// preference shouldn't be a harder failure than a missing transaction list.
// Every actual owned row (transactions, categories) already requires the
// user to exist via its FK, so this is strictly a display-formatting
// fallback, never a substitute for that ownership check.
export const getCurrentUserCurrency = cache(async (): Promise<string> => {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
  return user?.currency ?? "USD";
});
