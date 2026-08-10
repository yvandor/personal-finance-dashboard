"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

// Segment-scoped error boundary, same pattern as budgets/error.tsx and
// transactions/error.tsx.
export default function CategoriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Categories page error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm font-medium">Something went wrong loading your categories.</p>
      <p className="text-sm text-muted">
        {error.digest ? `Reference: ${error.digest}` : "Please try again."}
      </p>
      <Button type="button" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
