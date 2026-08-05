"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

// Segment-scoped error boundary, same pattern as transactions/error.tsx:
// only this route's content is replaced, and server error details are
// never forwarded here (Next redacts error.message in production, keeping
// only a digest for server-side logs).
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard page error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm font-medium">Something went wrong loading your dashboard.</p>
      <p className="text-sm text-muted">
        {error.digest ? `Reference: ${error.digest}` : "Please try again."}
      </p>
      <Button type="button" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
