import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./preview-tests",
  workers: 2,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5175",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
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
    command: "npx vite --config vite.staff-preview.config.ts",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: true,
  },
});
