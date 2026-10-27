import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  state,
  fixture,
  build,
  save,
  uid,
  accountId,
  profileId,
} from "./workoutFixture";

test("staff composes, reorders, previews and saves a protected workout; Owner assigns the whole session and the athlete records it once", async ({
  page,
  context,
  browser,
}, info) => {
  const backend = state();
  await fixture(context, backend);
  await build(page);
  await page.getByRole("button", { name: "Move Fictional drill 4 up" }).click();
  const expected = [uid(10), uid(11), uid(13), uid(12)];
  await expect(
    page
      .getByRole("list", { name: "Selected drill order" })
      .getByRole("listitem"),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Preview workout", exact: true })
    .click();
  const preview = page.getByRole("dialog");
  await expect(
    preview
      .getByRole("list", { name: "Preview workout order" })
      .getByRole("listitem"),
  ).toHaveCount(4);
  await expect(
    preview.getByText("Walk to marker 1.", { exact: true }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Next preview drill" }).click();
  await expect(
    preview.getByText("Walk to marker 2.", { exact: true }),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: "Back to workout editing" })
    .click();
  expect(backend.workouts.size).toBe(0);
  await save(page);
  expect([...backend.workouts.values()][0].resource_ids).toEqual(expected);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page.getByRole("button", { name: "Keep current assignment" }).click();
  expect(backend.counts.assigns).toBe(0);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .dblclick();
  await expect(
    page.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(backend.counts.assigns).toBe(1);
  await page.screenshot({
    path: `artifacts/workout-builder-${info.project.name}.png`,
    fullPage: true,
  });
  const parentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await fixture(parentContext, backend, "parent");
  const athlete = await parentContext.newPage();
  await athlete.goto(new URL("./?source=app#workspace", page.url()).href);
  await expect(
    athlete.getByRole("heading", {
      name: "Fictional complete practice",
      exact: true,
    }),
  ).toBeVisible();
  const startBounds = await athlete
    .getByRole("button", { name: "Guide and record practice" })
    .boundingBox();
  expect(startBounds!.y + startBounds!.height).toBeLessThan(750);
  await expect(athlete.locator(".session-fit")).not.toHaveAttribute("open");
  await athlete.getByText("Why this session?", { exact: true }).click();
  await expect(athlete.locator(".session-fit")).toContainText(
    "Matched to age 18+",
  );
  await athlete.getByText("Why this session?", { exact: true }).click();
  await athlete
    .getByRole("button", { name: "Guide and record practice" })
    .click();
  const session = athlete.getByRole("dialog");
  await expect(
    session.getByRole("list", { name: "Workout order" }).getByRole("listitem"),
  ).toHaveCount(4);
  await session.getByRole("checkbox").check();
  await session.getByRole("button", { name: "Begin workout" }).click();
  for (const [n, key] of expected.entries()) {
    await expect(
      session.getByRole("heading", {
        name: backend.resources.find((d) => d.id === key)!.content.title,
        exact: true,
      }),
    ).toBeVisible();
    if (n) await athlete.waitForTimeout(700);
    await session
      .getByRole("button", {
        name: n === 3 ? "Finish workout" : "Complete drill · Next",
        exact: true,
      })
      .click();
  }
  await expect(session).toHaveCount(0);
  expect(backend.counts.reports).toBe(1);
  await athlete.goto(new URL("./?source=app#app-progress", athlete.url()).href);
  await expect(
    athlete.getByRole("heading", {
      name: "Fictional complete practice",
      exact: true,
    }),
  ).toBeVisible();
  await athlete.reload();
  await expect(
    athlete.getByRole("heading", {
      name: "Fictional complete practice",
      exact: true,
    }),
  ).toBeVisible();
  await parentContext.close();
});
test("incompatible drills block preview and never publish a workout", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 1);
  await page
    .getByRole("button", { name: "Add Fictional drill 5 to workout" })
    .click();
  await page
    .getByRole("button", { name: "Preview workout", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("do not share");
  expect(backend.counts.saves).toBe(0);
  await page
    .getByRole("button", { name: "Remove Fictional drill 5 from workout" })
    .click();
  await save(page);
});
test("saved workouts survive refresh; lost save responses retry the same ID and unsaved edits can be kept", async ({
  page,
  context,
}) => {
  const backend = state();
  backend.failSave = true;
  await fixture(context, backend);
  await build(page, 2);
  await page
    .getByRole("button", { name: "Preview workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not confirmed",
  );
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(
    page.getByText(
      "Workout saved. An Owner can now assign this complete session.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(backend.workouts.size).toBe(1);
  await page.reload();
  await page
    .getByRole("button", { name: /Fictional complete practice.*version 1/ })
    .click();
  await expect(page.getByLabel("Workout name")).toHaveValue(
    "Fictional complete practice",
  );
  await page.getByLabel("Workout name").fill("Unsaved revision");
  await page.getByRole("button", { name: "New workout", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing workout" }).click();
  await expect(page.getByLabel("Workout name")).toHaveValue("Unsaved revision");
});
test("ineligible and conflicting assignments keep existing access unchanged", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 2);
  await save(page);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  backend.eligible = false;
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await expect(
    page
      .getByRole("region", { name: "Assign complete workout" })
      .getByRole("alert"),
  ).toContainText("No eligible athlete");
  expect(backend.counts.assigns).toBe(0);
  backend.eligible = true;
  await page.getByRole("button", { name: "Preview assignment" }).click();
  backend.failAssign = true;
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not confirmed",
  );
  await page.getByRole("button", { name: "Keep current assignment" }).click();
  expect(backend.assignment).toBeNull();
});
test("removing a template or current assignment requires confirmation", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 2);
  await save(page);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(
    page.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove current assignment" }).click();
  await page.getByRole("button", { name: "Keep current assignment" }).click();
  expect(backend.profileAssignments.get(profileId)?.workout_id).toBeTruthy();
  await page.getByRole("button", { name: "Remove current assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm removal of assignment" })
    .click();
  await expect(
    page.getByText(
      "Workout assignment removed. Existing history and separate access are unchanged.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove saved workout" }).click();
  await page.getByRole("button", { name: "Keep saved workout" }).click();
  expect(backend.counts.removes).toBe(0);
  await page.getByRole("button", { name: "Remove saved workout" }).click();
  await page.getByRole("button", { name: "Yes, remove workout" }).click();
  await expect(
    page.getByText("Workout removed. Existing practice history is unchanged.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(backend.workouts.size).toBe(0);
});
test("coach can build own workouts without an account directory or assignment controls", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend, "coach");
  await build(page, 2);
  await save(page);
  await expect(
    page.getByRole("region", { name: "Assign complete workout" }),
  ).toHaveCount(0);
});
test("workout builder fits small phones and has no detected WCAG A/AA violations", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 4);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("editing a template does not silently replace an account assignment and unsaved changes cannot be assigned", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 2);
  await save(page);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(
    page.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Workout name").fill("Revised complete practice");
  await expect(page.getByLabel("Assign to customer account")).toBeDisabled();
  await save(page);
  expect(backend.profileAssignments.get(profileId)?.workout_title).toBe(
    "Fictional complete practice",
  );
  expect(backend.counts.assigns).toBe(1);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await expect(
    page.getByRole("region", { name: "Assign complete workout" }),
  ).toContainText("Current workout: Fictional complete practice");
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await expect(page.getByRole("dialog")).toContainText("version 2");
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(
    page.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(backend.profileAssignments.get(profileId)?.workout_title).toBe(
    "Revised complete practice",
  );
});

for (const role of ["owner", "manager", "coach"]) {
  test(`${role} app starts directly in the focused staff home with working creation tools`, async ({
    page,
    context,
  }) => {
    await fixture(context, state(), role);
    await page.goto("./?source=app#app");
    await expect(page.locator(".app-staff-home")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open my training", exact: true }),
    ).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "App navigation" });
    await expect(
      nav.getByRole("link", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "Accounts & training access" }),
    ).toHaveCount(role === "owner" ? 1 : 0);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const action = await page
        .getByRole("link", { name: "Build a workout", exact: true })
        .boundingBox();
      expect(action!.height).toBeGreaterThanOrEqual(44);
      expect(action!.y + action!.height).toBeLessThan(750);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("link", { name: "Build a workout", exact: true })
      .click();
    await expect(page.getByLabel("Workout name")).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Content", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.goto("./?source=app#workspace");
    await page.getByRole("link", { name: "Upload a drill" }).click();
    await page.setViewportSize({ width: 390, height: 850 });
    await expect(
      page.getByRole("heading", { name: "Coach content studio" }),
    ).toBeVisible();
    await expect(page.locator(".publishing-settings")).not.toHaveAttribute(
      "open",
    );
    const picker = page.locator('input[type="file"]');
    await expect(picker).toBeVisible();
    const bounds = await picker.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThan(750);
    await page.getByText("Publishing options", { exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Refresh shared library" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Coach content studio" }),
    ).toBeVisible();
    await expect(page.locator(".publishing-settings")).not.toHaveAttribute(
      "open",
    );
  });
}
