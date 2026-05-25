import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/e2e/setup/global-setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ["tests/e2e/**/*.test.ts"],
    exclude: ["tests/e2e/load/**"],
  },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
