import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["preview/rehearsal/*.test.ts"] },
});
