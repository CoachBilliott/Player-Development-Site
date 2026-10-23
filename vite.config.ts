import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { appShell } from "./build/pwa";
export default defineConfig({
  plugins: [react(), appShell()],
  test: { include: ["src/**/*.test.ts"] },
});
