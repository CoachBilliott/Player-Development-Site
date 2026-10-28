import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { state, uid, staffId } from "./workoutFixture";
import {
  staffFixture,
  staffState,
  athleteA,
  athleteB,
} from "./staffServiceFixture";

function prepared() {
  const training = state(),
    staff = staffState();
  training.profiles = staff.rows
    .filter((r) => r.athlete_id)
    .map((r) => ({
      ...training.profiles[0],
      id: r.athlete_id!,
      owner_id: r.client_id,
      nickname: r.athlete_name!,
      age_group: r.age_group!,
      position: r.position!,
    }));
  const workout = {
    id: uid(700),
    title: "Fictional next-week practice",
    summary: "Illustrative practice.",
    resource_ids: [uid(10), uid(11)],
    created_by: staffId,
    version: 1,
    updated_at: new Date().toISOString(),
  };
  training.workouts.set(workout.id, workout);
  for (const row of staff.rows)
    if (row.athlete_id && row.workout_id)
      training.profileAssignments.set(row.athlete_id, {
        workout_id: row.workout_id,
        workout_title: row.workout_title,
        summary: "",
        resource_ids: row.resources.map((r) => r.id),
        workout_version: row.workout_version,
        version: 1,
      });
  return { training, staff, workout };
}
test("Owner assigns inside the athlete record without choosing another customer; cancel/repeated clicks preserve the sibling", async ({
  page,
  context,
}, info) => {
  const { training, staff, workout } = prepared();
  await staffFixture(context, staff, "owner", staffId, training);
  let directoryReads = 0;
  await context.route("**/rest/v1/rpc/list_account_access", (r) => {
    directoryReads++;
    return r.fallback();
  });
  const sibling = JSON.stringify(training.profileAssignments.get(athleteB));
  await page.goto("./#workspace");
  await page
    .getByRole("button", { name: /Fictional Jordan/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Assign training", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", {
      name: "Assign training to Fictional Jordan",
    }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: new RegExp(workout.title) }).click();
  await expect(page.getByLabel("Assign to customer account")).toHaveCount(0);
  await expect(page.getByLabel("Assign to athlete")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Preview assignment", exact: true })
    .click();
  const confirmation = dialog.getByRole("region", {
    name: "Assign this complete workout?",
  });
  await expect(confirmation).toContainText("Fictional Jordan");
  await expect(confirmation).toContainText(
    "This replaces only this athlete's current saved workout.",
  );
  await confirmation
    .getByRole("button", { name: "Keep current assignment" })
    .click();
  expect(training.counts.assigns).toBe(0);
  await dialog
    .getByRole("button", { name: "Preview assignment", exact: true })
    .click();
  await confirmation
    .getByRole("button", { name: "Confirm workout assignment", exact: true })
    .dblclick();
  await expect(dialog.getByRole("status")).toContainText(
    "Workout assignment saved for this athlete.",
  );
  expect(training.counts.assigns).toBe(1);
  expect(training.profileAssignments.get(athleteA)?.workout_id).toBe(
    workout.id,
  );
  expect(JSON.stringify(training.profileAssignments.get(athleteB))).toBe(
    sibling,
  );
  expect(directoryReads).toBe(0);
  await expect(page).toHaveURL(/#workspace$/);
  await expect(
    dialog.getByText(workout.title, { exact: true }).first(),
  ).toBeVisible();
  await mkdir("artifacts/athlete-context", { recursive: true });
  await page.screenshot({
    path: `artifacts/athlete-context/assigned-${info.project.name}.png`,
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("dialog").getByText(workout.title, { exact: true }).first(),
  ).toBeVisible();
});
test("missing fixed athlete never falls back to account-wide assignment", async ({
  page,
  context,
}) => {
  const { training, staff, workout } = prepared();
  training.profiles = [];
  await staffFixture(context, staff, "owner", staffId, training);
  await page.goto(`./?serviceAthlete=${athleteA}#workspace`);
  await page
    .getByRole("button", { name: "Assign training", exact: true })
    .click();
  await page.getByRole("button", { name: new RegExp(workout.title) }).click();
  await expect(page.getByRole("alert")).toContainText(
    "This athlete is no longer available",
  );
  const preview = page.getByRole("button", {
    name: "Preview assignment",
    exact: true,
  });
  if (await preview.count()) await expect(preview).toBeDisabled();
  expect(training.counts.assigns).toBe(0);
});
test("roster filters by existing age, position and coach without introducing group membership", async ({
  page,
  context,
}) => {
  const { training, staff } = prepared();
  await staffFixture(context, staff, "manager", staffId, training);
  await page.goto("./#workspace");
  await page
    .getByText("Filter by age, position or coach", { exact: true })
    .click();
  await page
    .getByLabel("Football position", { exact: true })
    .selectOption("Defensive back");
  await expect(
    page.getByRole("button", { name: /Fictional Avery/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Fictional Jordan/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Fictional Jordan/ }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Fictional Jordan/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Assign training", exact: true }),
  ).toHaveCount(0);
});
