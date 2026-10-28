import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "preview-tests",
  testMatch: "learning-rehearsal.spec.ts",
  workers: 1,
  retries: 0,
  outputDir: "test-results-learning-harness",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5201",
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
    launchOptions: {
      executablePath:
        !process.env.CI && existsSync("/usr/bin/chromium")
          ? "/usr/bin/chromium"
          : undefined,
      args: ["--no-sandbox"],
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command:
      "node scripts/build-learning-rehearsal.mjs && npx vite preview --config vite.learning-rehearsal.config.ts",
    url: "http://127.0.0.1:5201",
    reuseExistingServer: false,
  },
});
