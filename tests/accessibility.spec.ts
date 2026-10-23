import { disableBackend } from "./backendFixture";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ context }) => {
  await disableBackend(context);
});

test("main screens have no detected WCAG A/AA violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#onboarding");
  await page.getByRole("button", { name: /Morgan/ }).click();
  await page.getByRole("button", { name: "See my training" }).click();
  for (const route of [
    "home",
    "today",
    "library",
    "progress",
    "coach",
    "membership",
    "install",
    "onboarding",
  ]) {
    await page.goto("./#" + route);
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          summary: n.failureSummary,
        })),
      })),
      route,
    ).toEqual([]);
  }
  await page.goto("./#today");
  await page.getByRole("button", { name: "Start today’s session" }).click();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((d) => d.contains(document.activeElement)),
    ).toBe(true);
  }
  const check = async () => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  };
  await check();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Begin guided session" }).click();
  await check();
  await page.getByRole("button", { name: "Show practice steps" }).click();
  await check();
});
