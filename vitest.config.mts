import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

// Integration tests hit a real (separate) Postgres database, never mocked.
loadEnv({ path: ".env.test", quiet: true });

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    conditions: ["react-server"],
  },
  ssr: {
    // "server-only" (imported by every server/** module) no-ops under the
    // "react-server" condition, which is normally set by Next.js's bundler.
    // Vitest runs test files through Vite's SSR pipeline, which resolves
    // conditions from `ssr.resolve`, not the top-level `resolve` — without
    // this, importing anything under server/** throws "cannot be imported
    // from a Client Component". This does not weaken the guard for the
    // real app build; Next.js still enforces it there, and this only
    // teaches the test runner the same condition Next.js already sets.
    resolve: {
      conditions: ["react-server"],
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 20_000,
    testTimeout: 20_000,
    // Integration test files share one real Postgres database and reset a
    // fixed set of test-user rows in beforeEach. Running multiple files
    // concurrently lets one file's reset wipe data another file's test is
    // mid-assertion on. The suite is small and fast, so serializing file
    // execution is cheap -- simpler than giving every file distinct user
    // ids or moving to per-test transactional rollback.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      // Scoped to the modules this task's guardrails target -- money math
      // and the transaction/budget/analytics DALs -- rather than the whole
      // tree, so the thresholds mean something specific instead of being
      // diluted by untested UI or config files that have their own
      // (component-level, non-coverage-gated) test suite.
      include: [
        "lib/money.ts",
        "server/data/transactions.ts",
        "server/data/budgets.ts",
        "server/data/dashboard.ts",
      ],
      // Set a few points below the actual coverage at the time these were
      // added (statements 90.62%, branches 83.46%, functions 93.33%, lines
      // 91.39%) -- enough buffer that a trivial refactor doesn't flake the
      // gate, not so much that a real coverage regression slips through.
      thresholds: {
        lines: 88,
        functions: 90,
        branches: 80,
        statements: 88,
      },
    },
  },
});
