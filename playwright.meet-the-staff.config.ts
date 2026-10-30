import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./preview-tests",
  testMatch: "meet-the-staff.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5177",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npx vite --config vite.meet-the-staff.config.ts",
    url: "http://127.0.0.1:5177",
    reuseExistingServer: false,
  },
});
