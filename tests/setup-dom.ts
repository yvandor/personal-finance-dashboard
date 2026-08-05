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
