// vitest.e2e.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/e2e/setup/global-setup.ts"],
    pool: "forks",
    singleFork: true,
    // Run test FILES one at a time — required because beforeEach resets the
    // shared DB, and concurrent files would race against each other's resets.
    fileParallelism: false,
    // Per-test timeout: 30s for scenario tests. Load tests override per-test.
    testTimeout: 30_000,
    hookTimeout: 120_000, // runMigrations can be slow on a cold Docker DB
    include: ["tests/e2e/scenarios/**/*.test.ts"],
    exclude: ["tests/e2e/load/**"],
    reporters: ["verbose"],
    outputFile: {
      json: "tests/reports/latest.json",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "next/cache": resolve(__dirname, "tests/mocks/next-cache.ts"),
      "next/headers": resolve(__dirname, "tests/mocks/next-headers.ts"),
    },
  },
});
