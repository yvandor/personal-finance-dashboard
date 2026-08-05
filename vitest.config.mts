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
  },
});
