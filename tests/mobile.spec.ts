import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => disableBackend(context));

test("the app has its own welcome, persistent navigation and one usable customer demo", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?source=app#app");
  await expect(
    page.getByRole("heading", { name: "Your training starts here." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "App navigation" }),
  ).toBeVisible();
  await expect(
    page.locator(".hero-training-video, .desktop-nav, footer"),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Try the sample demo", exact: true })
    .click();
  await page.getByRole("button", { name: "Solo athlete", exact: true }).click();
  await page
    .getByRole("button", { name: "Start sample workout", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Begin sample practice" }).click();
  for (;;) {
    await dialog.getByRole("button", { name: "Show workout steps" }).click();
    await dialog.getByRole("checkbox").check();
    const submit = dialog.getByRole("button", {
      name: "Submit reported workout",
    });
    if (await submit.isVisible()) {
      await submit.dblclick();
      break;
    }
    await dialog.getByRole("button", { name: "Next workout drill" }).click();
  }
  await expect(
    page.getByText("Self-reported practice", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Solo athlete", exact: true }).click();
  await expect(
    page.getByText("Self-reported practice", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Exit demo · Back to app", exact: false })
    .click();
  await expect(page).toHaveURL(/source=app#app$/);
  await page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Help", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your app, explained." }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/mobile-help-${info.project.name}.png`,
    fullPage: true,
  });
  const check = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(check.violations).toEqual([]);
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
  await expect(page.getByRole("heading", { name: /Your game/ })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "App navigation" }),
  ).toHaveCount(0);
});
