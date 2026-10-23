import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "**/app.spec.ts",
  testIgnore: [],
  workers: 1,
  timeout: 45000,
  outputDir: "test-results-app",
  reporter: [
    ["list"],
    ...(process.env.CI ? [["github"] as [string]] : []),
    ["html", { open: "never", outputFolder: "playwright-report-app" }],
  ],
  use: { ...base.use, baseURL: "http://127.0.0.1:4180" },
  webServer: {
    command: "npm run preview -- --port 4180 --strictPort",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: false,
  },
});
