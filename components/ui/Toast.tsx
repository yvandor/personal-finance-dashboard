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
      className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 shadow-lg"
    >
      <p className="text-sm">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-semibold text-accent hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
