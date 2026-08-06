import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
  // Enforces the DAL boundary at build time, not just by convention: only
  // server/data/** (the DAL) may import the Prisma client singleton or
  // construct one directly. This is what makes "show me every query in the
  // app" reducible to `ls server/data/`, and what makes ownership
  // isolation auditable -- see docs/PROJECT_PLAN.md's architecture
  // section. Exemptions are every place that legitimately already touches
  // Prisma directly and predates this rule: server/db.ts itself (the one
  // place allowed to construct the client), and test/seed/E2E fixtures
  // (tests/**, e2e/**, prisma/**) which intentionally bypass the DAL for
  // direct setup/assertion against a real database, same as the DAL does.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["server/data/**", "server/db.ts", "tests/**", "e2e/**", "prisma/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/db",
              message:
                "Only server/data/** may import the Prisma client singleton -- add or use a function there instead of reaching into the database directly.",
            },
          ],
          patterns: [
            {
              group: ["@prisma/adapter-pg", "@/app/generated/prisma/client"],
              message:
                "Only server/db.ts may construct a PrismaClient. Import { prisma } from '@/server/db' via server/data/** instead; type-only imports of models/enums are unrestricted.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
