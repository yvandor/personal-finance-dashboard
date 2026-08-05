"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

// Segment-scoped error boundary: only this route's content is replaced, the
// sidebar/shell around it survives. Server error details (Prisma/driver
// messages, stack traces) are never forwarded here -- error.message from a
// thrown server-side error is redacted by Next in production and replaced
// with a generic message plus a digest for server-side logs.
export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Transactions page error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm font-medium">Something went wrong loading your transactions.</p>
      <p className="text-sm text-muted">
        {error.digest ? `Reference: ${error.digest}` : "Please try again."}
      </p>
      <Button type="button" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
