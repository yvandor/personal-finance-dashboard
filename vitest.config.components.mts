import { defineConfig } from "vitest/config";

// Separate from vitest.config.mts deliberately: that config sets the
// "react-server" resolve condition so server-only-guarded DAL modules can
// be imported in tests, but that condition swaps in a build of `react`
// that can't be rendered via `react-dom/client` -- exactly what
// @testing-library/react needs to mount a component in jsdom. Component
// tests never import anything under server/** directly (they render
// plain, prop-driven components), so they don't need that condition at
// all. Naming these files "*.test.tsx" (vs. the main suite's "*.test.ts")
// keeps them out of the main config's glob without an explicit exclude.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/components/**/*.test.tsx"],
    setupFiles: ["tests/setup-dom.ts"],
  },
});
