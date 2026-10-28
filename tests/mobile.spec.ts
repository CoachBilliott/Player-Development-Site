import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => disableBackend(context));

test("the app opens private account access and keeps the customer demo on the website", async ({
  page,
}) => {
  await page.goto("./?source=app#app");
  await expect(
    page.getByRole("heading", { name: "Your training starts here." }),
  ).toBeVisible();
  await expect(page.locator('a[href="#demo"]')).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "App navigation" }).getByRole("link"),
  ).toHaveText(["Start", "Log in", "Help"]);
  await page.goto("./?source=app#demo");
  await expect(page).toHaveURL(/#app$/);
  await page
    .getByRole("link", { name: "Log in to your account", exact: true })
    .click();
  await expect(page).toHaveURL(/#account$/);
  await page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Help", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your app, explained." }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("app navigation and forms fit small phones while the normal website stays intact", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?source=app#app");
  for (const width of [320, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const tab of await page
      .getByRole("navigation", { name: "App navigation" })
      .getByRole("link")
      .all())
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 390, height: 750 });
  await page.screenshot({
    path: `artifacts/mobile-welcome-${info.project.name}.png`,
    fullPage: true,
  });
  const check = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(check.violations).toEqual([]);
  await page
    .getByRole("link", { name: "Log in to your account", exact: true })
    .click();
  await expect(page).toHaveURL(/source=app#account$/);
  await page.goto("./#home");
  await expect(
    page.getByRole("heading", { name: /Know the game/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "App navigation" }),
  ).toHaveCount(0);
});
