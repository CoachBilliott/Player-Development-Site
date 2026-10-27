import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, state, save, accountId, profileId } from "./workoutFixture";

test("a coach submits privately, an Owner reviews, then builds and assigns the approved session", async ({
  page,
  context,
  browser,
}) => {
  const backend = state();
  backend.resources[0].review_stage = "draft";
  backend.resources[0].status = "draft";
  await fixture(context, backend, "coach");
  await page.goto("./?source=app#content-review");
  await page.getByLabel("Review stage").selectOption("draft");
  await page.getByRole("button", { name: "Preview & review" }).click();
  await expect(
    page.getByRole("button", { name: "Approve & publish", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Send for review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm send for review" })
    .dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.resources[0].status).toBe("draft");
  const owner = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await fixture(owner, backend, "owner");
  const staff = await owner.newPage();
  await staff.goto(new URL("./?source=app#content-review", page.url()).href);
  await staff.getByLabel("Review stage").selectOption("pending");
  await staff.getByRole("button", { name: "Preview & review" }).click();
  await staff
    .getByRole("button", { name: "Approve & publish", exact: true })
    .click();
  await expect(
    staff.getByRole("button", { name: "Confirm approval & publish" }),
  ).toBeDisabled();
  await staff.getByRole("checkbox").check();
  backend.failReview = true;
  await staff
    .getByRole("button", { name: "Confirm approval & publish" })
    .click();
  await expect(staff.getByRole("dialog").getByRole("alert")).toContainText(
    "Review was not confirmed",
  );
  await staff
    .getByRole("button", { name: "Confirm approval & publish" })
    .click();
  await expect(staff.getByRole("dialog")).toHaveCount(0);
  await staff.getByLabel("Review stage").selectOption("approved");
  const item = staff.locator(".approval-list > li").filter({
    has: staff.getByRole("heading", {
      name: "Fictional drill 1",
      exact: true,
    }),
  });
  await item
    .getByRole("button", { name: "Build a workout with this drill" })
    .click();
  await expect(staff.getByLabel("Workout name")).toHaveValue(
    "Fictional drill 1 practice",
  );
  await expect(
    staff
      .getByRole("list", { name: "Selected drill order" })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await staff
    .getByRole("button", { name: "Add Fictional drill 2 to workout" })
    .click();
  await save(staff);
  await staff.getByLabel("Assign to customer account").selectOption(accountId);
  await staff.getByRole("button", { name: "Preview assignment" }).click();
  await staff
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(
    staff.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(backend.profileAssignments.get(profileId)?.resource_ids).toHaveLength(
    2,
  );
  await owner.close();
});

test("unfinished practice resumes after refresh at the saved drill and finishes exactly once", async ({
  page,
  context,
}) => {
  const backend = state();
  const resources = backend.resources.slice(0, 2).map((r) => r.id);
  backend.assignment = {
    workout_id: "91000000-0000-4000-8000-000000000080",
    workout_title: "Fictional saved session",
    summary: "An original adult sample.",
    resource_ids: resources,
    workout_version: 1,
    version: 1,
  };
  await fixture(context, backend, "parent");
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Guide and record practice" }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Begin workout" }).click();
  await expect(
    d.getByRole("heading", { name: "Fictional drill 1", exact: true }),
  ).toBeVisible();
  backend.failResume = true;
  await d.getByRole("button", { name: "Complete drill · Next" }).click();
  await expect(d.getByRole("alert")).toContainText("Your place was not saved");
  await expect(
    d.getByRole("heading", { name: "Fictional drill 1", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(700);
  await d.getByRole("button", { name: "Complete drill · Next" }).click();
  await expect(
    d.getByRole("heading", { name: "Fictional drill 2", exact: true }),
  ).toBeVisible();
  await d.getByRole("button", { name: "Save & leave workout" }).click();
  expect(backend.counts.reports).toBe(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Resume workout", exact: true })
    .click();
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Resume practice" }).click();
  await expect(
    d.getByRole("heading", { name: "Fictional drill 2", exact: true }),
  ).toBeVisible();
  await d
    .getByRole("button", { name: "Finish workout", exact: true })
    .dblclick();
  await expect(d).toHaveCount(0);
  expect(backend.counts.reports).toBe(1);
  expect(backend.resumes.has(`${accountId}:${profileId}`)).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume workout", exact: true }),
  ).toHaveCount(0);
});

test("saved-practice deletion is explicit and cancel keeps the saved place", async ({
  page,
  context,
}) => {
  const backend = state();
  backend.assignment = {
    workout_id: "91000000-0000-4000-8000-000000000080",
    workout_title: "Fictional short session",
    summary: "",
    resource_ids: [backend.resources[0].id],
    workout_version: 1,
    version: 1,
  };
  await fixture(context, backend, "parent");
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Guide and record practice" }).click();
  let d = page.getByRole("dialog");
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Begin workout" }).click();
  await d.getByRole("button", { name: "Save & leave workout" }).click();
  await page
    .getByRole("button", { name: "Discard saved practice", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Keep saved practice" }).click();
  await expect(
    page.getByRole("button", { name: "Resume workout", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Discard saved practice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard saved practice permanently" })
    .click();
  await expect(
    page.getByRole("button", { name: "Guide and record practice" }),
  ).toBeVisible();
  expect(backend.counts.reports).toBe(0);
});

test("review queue fits phone widths and keeps accessibility controls readable", async ({
  page,
  context,
}) => {
  const backend = state();
  backend.resources[0].review_stage = "changes_requested";
  backend.resources[0].review_notes = "Clarify the original practice steps.";
  await fixture(context, backend);
  await page.goto("./?source=app#content-review");
  await expect(
    page.getByRole("heading", { name: "Ready for the next player." }),
  ).toBeVisible();
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
