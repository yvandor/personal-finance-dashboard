import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react's auto-cleanup only registers itself when it
// finds a global `afterEach` (e.g. Vitest's `globals: true`). This project
// deliberately imports test globals explicitly rather than injecting them
// (see vitest.config.mts), so cleanup is wired up by hand here instead --
// without it, every test's render stays mounted in `document.body`,
// accumulating across tests in the same file and breaking any query that
// expects a single match.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement ResizeObserver at all, and Recharts'
// ResponsiveContainer uses it internally -- without this, mounting any
// chart component throws "ResizeObserver is not defined" and crashes the
// test outright, rather than just rendering at zero size (which is the
// separate, expected jsdom limitation component tests work around by
// asserting against the accessible text-table companion instead of the
// chart SVG -- see TrendChart.tsx / CategoryBreakdownChart.tsx).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// jsdom's HTMLDialogElement is an empty stub -- it reflects the `open`
// attribute but does not implement showModal()/close() at all (confirmed
// empirically: `typeof dialog.showModal` is `undefined`; see
// node_modules/jsdom/lib/jsdom/living/nodes/HTMLDialogElement-impl.js,
// which has no overrides beyond HTMLElement). Modal.tsx calls these
// directly, so without a polyfill every dialog-based test throws the
// moment a dialog opens.
//
// This polyfill mimics the two behaviors Modal.tsx actually depends on the
// native contract for -- focus moving into the dialog on open, and
// returning to whatever was previously focused on close -- matching what
// was empirically verified live in Chrome during this project's dialog-
// centering investigation (P0), not a guess. It intentionally does NOT
// simulate Escape-triggering-cancel or top-layer stacking: those are
// platform behaviors outside this component's control, so dialog tests
// instead dispatch a `cancel` event directly to verify Modal's own
// onCancel wiring, which is the part our code is actually responsible for.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  const previouslyFocused = new WeakMap<HTMLDialogElement, HTMLElement | null>();

  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    previouslyFocused.set(this, document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.setAttribute("open", "");
    const focusable = this.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? this).focus();
  };

  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
    previouslyFocused.get(this)?.focus();
  };
}
