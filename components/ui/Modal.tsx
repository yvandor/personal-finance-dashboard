"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// Module-level count of currently-open Modal instances, not per-instance
// state -- several dialogs are always mounted at once (one per row's
// edit/delete, plus the header's add; see TransactionList's comment on
// rendering both the desktop table and mobile card list simultaneously),
// but at most one is ever actually open. A shared counter lets each
// instance's own open/close transition safely increment/decrement without
// one instance's cleanup clobbering another's still-needed lock.
//
// This exists because showModal()'s native top-layer/::backdrop behavior
// was verified (not assumed) to NOT stop a wheel-scroll gesture from
// scrolling the page underneath an open dialog in Chromium -- caught by
// e2e/mobile-audit.spec.ts's scroll-lock test actually failing on its
// first real run, not by reasoning about the spec in the abstract.
let openModalCount = 0;

function lockBodyScroll(): void {
  if (openModalCount === 0) {
    document.body.style.overflow = "hidden";
  }
  openModalCount += 1;
}

function unlockBodyScroll(): void {
  openModalCount = Math.max(openModalCount - 1, 0);
  if (openModalCount === 0) {
    document.body.style.overflow = "";
  }
}

// Built on the native <dialog> element rather than a hand-rolled overlay:
// showModal() gives focus trapping and top-layer stacking for free, and the
// browser fires a "cancel" event on Escape, which we treat the same as
// clicking the close button.
export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Several dialogs (one per row's edit/delete, plus the header's add) are
  // always mounted at once -- see TransactionList's comment on rendering
  // both the desktop table and mobile card list simultaneously. A hardcoded
  // id would duplicate across every instance, breaking aria-labelledby for
  // whichever isn't first in the DOM. useId() is unique per instance.
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      lockBodyScroll();
    } else if (!open && dialog.open) {
      dialog.close();
      // unlockBodyScroll() is NOT called here -- see the dedicated "close"
      // listener below, which is the single code path for the unlock
      // regardless of whether the dialog closed programmatically (this
      // branch) or natively (Escape, or a backdrop click's onClick handler
      // below, which only calls onClose and relies on this same effect to
      // actually call dialog.close()). dialog.close() dispatches "close"
      // either way, so routing the unlock through that one listener avoids
      // needing to duplicate this logic across every closing path.
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleNativeClose = () => unlockBodyScroll();
    dialog.addEventListener("close", handleNativeClose);
    return () => {
      dialog.removeEventListener("close", handleNativeClose);
      // If this instance unmounts (e.g. a client-side navigation) while
      // still open, its own "close" event will never fire -- release the
      // lock here too so a lingering mount doesn't leave scrolling
      // disabled forever. Safe to call unconditionally: unlockBodyScroll()
      // floors the counter at 0 rather than going negative if the dialog
      // already closed normally first.
      if (dialog.open) {
        unlockBodyScroll();
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      // The native <dialog> UA stylesheet centers a modal dialog via
      // `position:fixed; inset:0; margin:auto` -- but Tailwind's Preflight
      // reset (`*, ::before, ::after { margin: 0 }`) is author-origin CSS,
      // which overrides a user-agent-origin rule regardless of selector
      // specificity. That zeroes the one property (`margin`) doing the
      // centering while leaving `position`/`inset` (which Preflight never
      // touches) intact -- the dialog ends up pinned to the top-left
      // instead of centered. `m-auto` restores it explicitly rather than
      // relying on the UA default surviving future Tailwind/Preflight
      // changes. On mobile, w-full already resolves to 100% of the
      // available space, so there's no extra space for the auto margins to
      // distribute -- this only changes desktop/tablet centering.
      className="m-auto w-full max-w-lg rounded-xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-2 text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}
