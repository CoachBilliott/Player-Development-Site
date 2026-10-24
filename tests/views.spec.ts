import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => disableBackend(context));
test("public navigation separates marketing, demo views and sign-in; every preview fits phones and passes accessibility", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("./#home");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Drill library", exact: true }),
  ).toHaveCount(0);
  await page.goto("./#demo");
  await expect(page.locator(".view-card")).toHaveCount(6);
  const headings = {
    owner: "Your platform. Your playbook.",
    manager: "Keep the team moving.",
    coach: "Coach content studio",
    parent: "Your family. Their next step.",
    athlete: "Your training. Your next step.",
    junior: "Ready for your next practice?",
  };
  for (const [view, heading] of Object.entries(headings)) {
    await page.goto("./#demo-" + view);
    await expect(
      page.getByRole("heading", { name: heading, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/Fictional .* preview · local changes only/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      view,
    ).toBe(true);
    const checks = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      checks.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
      view,
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/view-${view}-${info.project.name}.png`,
      fullPage: true,
    });
  }
  await page.goto("./#workspace");
  await expect(
    page.getByRole("heading", { name: "Sign in to open your workspace." }),
  ).toBeVisible();
  await page.goto("./#access");
  await expect(
    page.getByRole("heading", { name: "Owner access is required." }),
  ).toBeVisible();
  await page.goto("./#member-library");
  await expect(
    page.getByRole("heading", { name: "Sign in to open your workspace." }),
  ).toBeVisible();
});
test("Owner preview confirms and cancels fictional access changes without granting real access", async ({
  page,
}) => {
  await page.goto("./#demo-owner");
  await page.getByRole("link", { name: /Staff & account access/ }).click();
  await expect(page.getByLabel("Account level for Taylor")).toBeDisabled();
  await page.getByLabel("Account level for Drew").selectOption("manager");
  await page.getByRole("button", { name: "Keep current role" }).click();
  await expect(page.getByLabel("Account level for Drew")).toHaveValue("coach");
  await page.getByLabel("Account level for Drew").selectOption("manager");
  await page.getByRole("button", { name: "Confirm demo change" }).dblclick();
  await expect(page.getByLabel("Account level for Drew")).toHaveValue(
    "manager",
  );
  await page.reload();
  await expect(page.getByLabel("Account level for Drew")).toHaveValue("coach");
  await page.goto("./#access");
  await expect(
    page.getByRole("heading", { name: "Owner access is required." }),
  ).toBeVisible();
});
test("Junior preview follows the permission in Parent preview and cannot approve itself or see siblings", async ({
  page,
}) => {
  await page.goto("./#demo-junior");
  await expect(
    page.getByRole("button", { name: "Start sample workout", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("group", { name: "Fictional athletes" }).getByRole("button"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Allow athlete self-recording" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Parent demo", exact: true }).click();
  await page.getByRole("button", { name: /^Casey/ }).click();
  await page
    .getByRole("button", { name: "Allow athlete self-recording" })
    .click();
  await page.getByRole("button", { name: "Save athlete permission" }).click();
  await page.goto("./#demo-junior");
  await expect(
    page.getByRole("button", { name: "Start sample workout", exact: true }),
  ).toBeEnabled();
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
  await expect(
    page.getByText("Awaiting parent review", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve workout", exact: true }),
  ).toHaveCount(0);
  await page.goto("./#demo-parent");
  await page.getByRole("button", { name: /^Casey/ }).click();
  await page
    .getByRole("button", { name: "Approve workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm parent review" }).click();
  await page.goto("./#demo-junior");
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
});
