import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
import { mockProject } from "./contentFixture";
test.beforeEach(async ({ context }) => disableBackend(context));
async function finishPractice(page: Page) {
  await page
    .getByRole("button", { name: "Start sample workout", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Begin sample practice" }).click();
  for (;;) {
    await d.getByRole("button", { name: "Show workout steps" }).click();
    await d.getByRole("checkbox").check();
    const submit = d.getByRole("button", { name: "Submit reported workout" });
    if (await submit.isVisible()) {
      await submit.dblclick();
      break;
    }
    await d.getByRole("button", { name: "Next workout drill" }).click();
  }
}
test("the public website has one customer demo entry, with parent and solo journeys and no staff gallery", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("./#home");
  await expect(page.getByRole("heading", { name: /Your game/ })).toBeVisible();
  const header = page.getByRole("banner");
  await expect(
    header.getByRole("link", { name: "Try the demo", exact: true }),
  ).toHaveCount(0);
  await expect(
    header.getByRole("link", { name: "Log in", exact: true }),
  ).toBeVisible();
  await header.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/#account$/);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Player Development", exact: true })
    .click();
  await expect(page).toHaveURL(/#home$/);
  const buttons = page.getByRole("link", { name: "Try the demo", exact: true });
  for (let i = 0; i < (await buttons.count()); i++)
    await expect(buttons.nth(i)).toHaveAttribute("href", "#demo");
  await expect(
    page.locator(
      'a[href*="demo-owner"],a[href*="demo-manager"],a[href*="demo-coach"]',
    ),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: /library/i }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `artifacts/customer-home-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("main")
    .getByRole("link", { name: "Try the demo", exact: true })
    .click();
  await expect(page).toHaveURL(/#demo$/);
  await expect(
    page.getByRole("heading", { name: "See how your training works." }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Who are you setting up training for?" })
      .getByRole("button"),
  ).toHaveCount(2);
  await expect(page.locator(".view-card")).toHaveCount(0);
  for (const journey of ["Parent & family", "Solo athlete"]) {
    await page.getByRole("button", { name: journey, exact: true }).click();
    const checks = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      checks.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/customer-demo-${journey.startsWith("Parent") ? "parent" : "solo"}-${info.project.name}.png`,
      fullPage: true,
    });
  }
  await expect(
    page.getByRole("button", { name: "Allow athlete self-recording" }),
  ).toHaveCount(0);
  await finishPractice(page);
  await expect(
    page.getByText("Self-reported practice", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Solo athlete", exact: true }).click();
  await expect(
    page.getByText("Self-reported practice", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Exit demo · Back to website", exact: false })
    .click();
  await expect(page).toHaveURL(/#home$/);
});
test("old staff preview links require real sign-in and public uploads have no anonymous editor", async ({
  page,
  context,
}) => {
  await mockProject(context, new Map());
  for (const route of [
    "demo-owner",
    "demo-manager",
    "demo-coach",
    "demo-owner-access",
    "demo-launch",
  ]) {
    await page.goto("./#" + route);
    await expect(page).toHaveURL(/#workspace$/);
    await expect(
      page.getByRole("heading", { name: "Sign in to open your workspace." }),
    ).toBeVisible();
    await expect(page.getByLabel(/Account level for/)).toHaveCount(0);
  }
  await page.goto("./#coach");
  await expect(
    page.getByRole("heading", { name: "Coach sign-in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Choose a video or file", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "This browser", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Try a practice upload without signing in",
    }),
  ).toHaveCount(0);
  for (const route of [
    "family-demo",
    "demo-parent",
    "demo-athlete",
    "demo-junior",
  ]) {
    await page.goto("./#" + route);
    await expect(page).toHaveURL(/#demo$/);
    await expect(
      page.getByRole("heading", { name: "See how your training works." }),
    ).toBeVisible();
  }
});
test("the single parent journey teaches permissions, athlete reporting and parent review with isolated persistent history", async ({
  page,
}) => {
  await page.goto("./#demo");
  await page.getByRole("button", { name: /^Casey/ }).click();
  await page
    .getByRole("button", { name: "Try athlete's screen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start sample workout", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("group", { name: "Fictional athletes" }).getByRole("button"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Back to parent controls" }).click();
  await page
    .getByRole("button", { name: "Allow athlete self-recording" })
    .click();
  await page.getByRole("button", { name: "Save athlete permission" }).click();
  await page
    .getByRole("button", { name: "Try athlete's screen", exact: true })
    .click();
  await finishPractice(page);
  await expect(
    page.getByText("Awaiting parent review", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve workout", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Back to parent controls" }).click();
  await page
    .getByRole("button", { name: "Approve workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm parent review" }).click();
  await page.reload();
  await page.getByRole("button", { name: /^Casey/ }).click();
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Avery/ }).click();
  await expect(
    page.getByText("No workouts recorded for this athlete yet."),
  ).toBeVisible();
});
