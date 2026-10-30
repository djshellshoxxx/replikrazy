import { defineConfig } from "vitest/config";
// The canonical app uses Vitest; the standalone planner owns a node:test suite.
// Run both via npm run test:all rather than loading node:test inside Vitest.
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
