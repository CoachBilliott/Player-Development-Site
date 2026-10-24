import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => disableBackend(context));
async function finishFamilyWorkout(
  page: Page,
  button = "Start sample workout",
) {
  await page.getByRole("button", { name: button, exact: true }).click();
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
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("family athletes have separate permissions, reports and parent approvals that survive refresh", async ({
  page,
}) => {
  await page.goto("./#family-demo");
  await page
    .getByRole("button", { name: "Add fictional athlete Jordan" })
    .click();
  await page.getByRole("button", { name: "Athlete view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start sample workout", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("group", { name: "Fictional athletes" }).getByRole("button"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Parent view", exact: true }).click();
  await page
    .getByRole("button", { name: "Allow athlete self-recording" })
    .click();
  await page.getByRole("button", { name: "Keep current permission" }).click();
  await expect(
    page.getByRole("button", { name: "Allow athlete self-recording" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Allow athlete self-recording" })
    .click();
  await page
    .getByRole("button", { name: "Save athlete permission" })
    .dblclick();
  await page.getByRole("button", { name: "Athlete view", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Jordan’s workouts" }),
  ).toBeVisible();
  await finishFamilyWorkout(page);
  await expect(
    page.getByText("Awaiting parent review", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve workout", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Parent view", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel review" }).click();
  await expect(
    page.getByText("Awaiting parent review", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm parent review" }).dblclick();
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Jordan/ }).click();
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Avery/ }).click();
  await expect(
    page.getByText("No workouts recorded for this athlete yet."),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Jordan/ }).click();
  await page.getByRole("button", { name: "Turn self-recording off" }).click();
  await page.getByRole("button", { name: "Save athlete permission" }).click();
  await page.getByRole("button", { name: "Athlete view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start sample workout", exact: true }),
  ).toBeDisabled();
});
test("individual athletes self-report without parent approval; unfinished workouts and repeat requests are honest", async ({
  page,
}) => {
  await page.goto("./#family-demo");
  await page
    .getByRole("button", { name: "Individual athlete", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start sample workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "End without recording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep practicing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "End without recording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard unfinished workout", exact: true })
    .click();
  await expect(
    page.getByText("No workouts recorded for this athlete yet."),
  ).toBeVisible();
  await finishFamilyWorkout(page);
  await expect(
    page.getByText("Self-reported practice", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve workout", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Parent view", exact: true }).click();
  await page.getByRole("button", { name: /^Casey/ }).click();
  await page
    .getByRole("button", { name: "Allow athlete self-recording" })
    .click();
  await page.getByRole("button", { name: "Save athlete permission" }).click();
  await page.getByRole("button", { name: "Athlete view", exact: true }).click();
  await finishFamilyWorkout(page);
  await page.getByRole("button", { name: "Parent view", exact: true }).click();
  await page
    .getByRole("button", { name: "Ask to practice again", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm parent review" }).click();
  await expect(
    page.getByText("Practice again together", { exact: true }),
  ).toBeVisible();
});
test("failed permission saves preserve parent control, and the family demo fits phones and passes accessibility checks", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (testInfo.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("./#family-demo");
  await page
    .getByRole("button", { name: "Allow athlete self-recording" })
    .click();
  await page.evaluate(() => {
    Reflect.set(window, "familySavedSetItem", Storage.prototype.setItem);
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save athlete permission" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "storage is unavailable",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = Reflect.get(window, "familySavedSetItem");
  });
  await page.getByRole("button", { name: "Keep current permission" }).click();
  await expect(
    page.getByRole("button", { name: "Allow athlete self-recording" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const checks = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    checks.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.html),
    })),
  ).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/family-controls-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
