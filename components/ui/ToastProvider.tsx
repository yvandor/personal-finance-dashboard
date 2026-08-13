"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Toast } from "./Toast";

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  /** Milliseconds before the toast auto-dismisses and the returned promise resolves `false`. */
  duration?: number;
}

interface ToastEntry {
  id: string;
  message: string;
  /** Undefined renders a plain, action-less notice -- see showNotice. */
  actionLabel?: string;
  duration: number;
}

interface ToastContextValue {
  /**
   * Shows a toast with an action button and returns a promise that
   * resolves `true` if the action was clicked before `duration` elapses,
   * `false` once it times out. This is the undo-on-delete primitive: a
   * caller awaits this promise to learn whether the user undid the action
   * before committing it for real -- see the Delete*Button components under components/.
   */
  showToast: (options: ToastOptions) => Promise<boolean>;
  /**
   * A plain, dismiss-only notice with no action button -- for the rare
   * case a deferred delete fails server-side *after* its undo window
   * already closed (the row is restored and this reports why).
   */
  showNotice: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// The one Context in this codebase (every other cross-component
// communication here is plain props -- see components/budgets/BudgetsBoard.tsx
// and its siblings) because a toast is a genuinely app-wide concern: any
// delete action on any page needs to trigger one, and prop-drilling a
// trigger function from the root layout through every page and every row
// component would be far worse than the one Context this actually needs.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const resolversRef = useRef(new Map<string, (undone: boolean) => void>());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Every setToasts call below is wrapped in flushSync. Without it, a
  // toast triggered from inside another component's pending
  // startTransition (exactly how every Delete*Button here calls this --
  // see e.g. components/budgets/DeleteBudgetButton.tsx) never actually
  // paints: a *plain* setState dispatched deep inside someone else's
  // pending transition inherits that transition's low priority and
  // doesn't get flushed until the transition itself settles -- but this
  // transition can't settle until the user sees and can click the toast's
  // Undo button, a deadlock. useOptimistic is exempt from this (rendering
  // its optimistic value immediately is its entire purpose, confirmed
  // empirically), plain useState is not. flushSync forces this specific
  // update to commit synchronously and immediately, independent of
  // whatever transition happens to be in flight around the caller.
  const dismiss = useCallback((id: string, undone: boolean) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    const resolve = resolversRef.current.get(id);
    if (resolve) {
      resolve(undone);
      resolversRef.current.delete(id);
    }
    flushSync(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    });
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const entry: ToastEntry = {
        id,
        message: options.message,
        actionLabel: options.actionLabel ?? "Undo",
        duration: options.duration ?? 5000,
      };
      const promise = new Promise<boolean>((resolve) => {
        resolversRef.current.set(id, resolve);
      });
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id, false), entry.duration),
      );
      flushSync(() => {
        setToasts((prev) => [...prev, entry]);
      });
      return promise;
    },
    [dismiss],
  );

  const showNotice = useCallback(
    (message: string, duration = 5000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id, false), duration),
      );
      flushSync(() => {
        setToasts((prev) => [...prev, { id, message, duration }]);
      });
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast, showNotice }}>
      {children}
      {/* pointer-events-none on the full-width stack, re-enabled per Toast:
          the container spans the viewport even when empty, and would otherwise
          swallow clicks on whatever sits along the bottom of the page. The
          bottom offset folds the safe-area inset into the same declaration as
          the normal 1rem gap -- see the note in app/globals.css on why a bare
          .pb-safe utility would replace that 1rem rather than add to it. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--safe-area-bottom)+1rem)] z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            actionLabel={t.actionLabel}
            onAction={t.actionLabel ? () => dismiss(t.id, true) : undefined}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
