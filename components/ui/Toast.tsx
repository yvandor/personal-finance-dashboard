interface ToastProps {
  message: string;
  /** Omitted for a plain, dismiss-only notice -- no button is rendered. */
  actionLabel?: string;
  onAction?: () => void;
}

// role="status" + aria-live="polite" (not "assertive"): a deletion undo
// window is informative, not urgent enough to interrupt a screen reader
// mid-sentence -- same politeness level as this app's other non-error
// live regions.
export function Toast({ message, actionLabel, onAction }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex w-full max-w-sm items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 shadow-overlay"
    >
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-md px-1 text-sm font-semibold text-accent outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
