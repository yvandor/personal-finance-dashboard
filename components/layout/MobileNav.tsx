"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS } from "@/lib/navigation";

// Built on the native <dialog> element, same reasoning as components/ui/Modal.tsx:
// showModal() gives focus trapping and top-layer stacking for free, and
// Escape fires a native "cancel" event we treat as close. Unlike Modal
// (a centered box), this renders as a full-height panel sliding in from the
// left -- the dialog element itself just supplies the a11y machinery, not
// the visual shape.
//
// Before this component existed, the mobile header was a static "Finance"
// label with no way to reach any route except Transactions (the
// post-"/"-redirect default) by typing a URL directly -- see the v1.3
// mobile-usability review. This is the fix.
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Closing on every route change (not just an explicit link click) also
  // covers browser back/forward navigation while the drawer is open. Adjusts
  // state during render rather than in an effect -- React's documented
  // pattern for "resetting state when a prop changes" without the extra
  // render-then-effect round trip a useEffect([pathname]) would cause (see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="rounded-md p-2 text-muted hover:bg-surface-hover hover:text-foreground"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
        aria-label="Navigation menu"
        className="m-0 h-dvh max-h-dvh w-72 max-w-[80vw] border-none bg-surface p-0 text-foreground backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-lg font-semibold">Finance</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-md p-1 text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-surface-hover text-foreground" : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </dialog>
    </>
  );
}
