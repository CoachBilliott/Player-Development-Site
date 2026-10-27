/* global process, console, document, innerWidth */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

// Public review captures only. Never connect to accounts or production data.
const base = process.env.BRAND_REVIEW_URL || "http://127.0.0.1:5173";
const directory = "artifacts/repformed";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  for (const [name, width, height, route] of [
    ["desktop-home", 1440, 1000, "/"],
    ["phone-home", 390, 844, "/"],
    ["phone-app", 390, 844, "/?source=app#app"],
    ["phone-small-app", 320, 740, "/?source=app#app"],
    ["desktop-contact", 1440, 1000, "/#contact"],
    ["phone-contact", 390, 844, "/#contact"],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    await page.route("**/content-config.json", (request) =>
      request.fulfill({
        json: {
          enabled: false,
          url: "",
          publishableKey: "",
          membersEnabled: false,
        },
      }),
    );
    await page.goto(base + route);
    await page.locator("h1").waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map(async (image) => {
          image.loading = "eager";
          await image.decode().catch(() => {});
        }),
      );
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    if (overflow) throw new Error(`${name} has horizontal overflow`);
    await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
    console.log(`${name}: ${width}px, no horizontal overflow`);
    await page.close();
  }
} finally {
  await browser.close();
}
