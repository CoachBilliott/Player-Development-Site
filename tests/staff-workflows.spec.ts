import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import {
  fixture,
  state,
  uid,
  staffId,
  accountId,
  profileId,
} from "./workoutFixture";
import { staffFixture, staffState, athleteC } from "./staffServiceFixture";
function sampleWorkout(backend: ReturnType<typeof state>) {
  const w = {
    id: uid(100),
    title: "Fictional weekly practice",
    summary: "Controlled noncontact practice.",
    resource_ids: [uid(10), uid(11)],
    created_by: staffId,
    version: 1,
    updated_at: new Date().toISOString(),
  };
  backend.workouts.set(w.id, w);
  return w;
}
test("legacy workout links retain guarded assignment, cancellation and replacement confirmation", async ({
  page,
  context,
}, info) => {
  const backend = state();
  const workout = sampleWorkout(backend);
  await fixture(context, backend);
  await page.goto("./#training");
  await expect(
    page.getByRole("heading", { name: "Your training bank." }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search training bank" })
    .fill("not present");
  await expect(
    page.getByRole("heading", { name: "No workouts match." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.goto(`./?trainingWorkout=${workout.id}#training-assign`);
  await expect(
    page.getByRole("heading", { name: "Who is this workout for?" }),
  ).toBeVisible();
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await expect(page.getByLabel("Assign to athlete")).toHaveValue(profileId);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "This replaces only this athlete's current saved workout.",
  );
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
  expect(backend.profileAssignments.get(profileId)?.resource_ids).toEqual(
    workout.resource_ids,
  );
  await mkdir("artifacts/staff-workflows", { recursive: true });
  await page.screenshot({
    path: `artifacts/staff-workflows/assign-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Choose a different workout" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose a saved workout." }),
  ).toBeFocused();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Who is this workout for?" }),
  ).toBeFocused();
  expect(backend.counts.assigns).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Who is this workout for?" }),
  ).toBeVisible();
});
for (const role of ["manager", "coach"] as const)
  test(`${role} sees three clear jobs without gaining owner assignment or role administration`, async ({
    page,
    context,
  }) => {
    const backend = state();
    sampleWorkout(backend);
    await fixture(context, backend, role);
    let privileged = 0;
    await context.route("**/rest/v1/rpc/list_account_access_v2", (r) => {
      privileged++;
      return r.fallback();
    });
    await page.goto("./#workspace");
    const nav = page.getByRole("navigation", { name: "Workspace navigation" });
    await expect(nav.getByRole("link")).toHaveText([
      "Athletes",
      "Training",
      "Staff & settings",
    ]);
    await nav.getByRole("link", { name: "Training", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Assign workout", exact: true }),
    ).toHaveCount(0);
    await page.goto("./#training-assign");
    await expect(
      page.getByRole("heading", { name: "An Owner assigns workouts." }),
    ).toBeVisible();
    await page.goto("./#staff-settings");
    await expect(
      page.getByRole("heading", { name: "Your staff settings." }),
    ).toBeVisible();
    await expect(page.getByLabel("Find an account by email")).toHaveCount(0);
    expect(privileged).toBe(0);
    expect(backend.counts.assigns).toBe(0);
  });
test("Owner staff administration expands one account and a canceled change leaves permissions intact", async ({
  page,
  context,
}, info) => {
  await fixture(context, state());
  await page.goto("./#staff-settings");
  await expect(
    page.getByRole("heading", { name: "Staff & settings." }),
  ).toBeVisible();
  const directory = page.locator(".access-directory");
  await expect(directory.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("button", { name: "All accounts", exact: true }).click();
  const first = directory.locator("details.access-person").filter({
    has: page.getByText("fictional-parent@example.test", { exact: true }),
  });
  await first.locator("summary").click();
  await expect(first.getByRole("combobox")).toBeVisible();
  const current = await first.getByRole("combobox").inputValue();
  await first.getByRole("combobox").selectOption("coach");
  await first.getByRole("button", { name: "Review access change" }).click();
  await page.getByRole("button", { name: "Keep current level" }).click();
  await expect(
    first.getByRole("button", { name: "Review access change" }),
  ).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "All accounts", exact: true }).click();
  await first.locator("summary").click();
  await expect(first.getByRole("combobox")).toHaveValue(current);
  await mkdir("artifacts/staff-workflows", { recursive: true });
  await page.screenshot({
    path: `artifacts/staff-workflows/staff-${info.project.name}.png`,
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("athlete service keeps assignment context and uncommon settings out of the daily roster", async ({
  page,
  context,
}, info) => {
  await staffFixture(context, staffState());
  await page.goto("./#workspace");
  await expect(
    page.getByRole("heading", { level: 1, name: "Athletes." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Owner delivery settings" }),
  ).toHaveCount(0);
  await page.getByRole("searchbox").fill("Morgan");
  await page
    .getByRole("button", { name: /Fictional Morgan/ })
    .first()
    .click();
  const assign = page
    .getByRole("dialog")
    .getByRole("button", { name: "Assign training", exact: true });
  await assign.click();
  await expect(
    page.getByRole("heading", { name: "Assign training to Fictional Morgan" }),
  ).toBeFocused();
  await expect(page.getByLabel("Assign to customer account")).toHaveCount(0);
  await expect(page.getByLabel("Assign to athlete")).toHaveCount(0);
  await expect(page).toHaveURL(
    new RegExp(`serviceAthlete=${athleteC}#workspace$`),
  );
  await mkdir("artifacts/staff-workflows", { recursive: true });
  await page.screenshot({
    path: `artifacts/staff-workflows/athlete-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cancel assignment", exact: true })
    .click();
  await expect(assign).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const role of ["parent", "athlete"] as const)
  test(`${role} cannot open staff training, assignments or people through copied URLs`, async ({
    page,
    context,
  }) => {
    const backend = state();
    sampleWorkout(backend);
    await fixture(context, backend, role);
    let bankReads = 0,
      directoryReads = 0;
    await context.route("**/rest/v1/training_workouts**", (r) => {
      bankReads++;
      return r.fallback();
    });
    await context.route("**/rest/v1/rpc/list_account_access_v2", (r) => {
      directoryReads++;
      return r.fallback();
    });
    await page.goto("./#training");
    await expect(
      page.getByRole("heading", { name: "Staff access is required." }),
    ).toBeVisible();
    await page.goto("./#training-assign");
    await expect(
      page.getByRole("heading", { name: "An Owner assigns workouts." }),
    ).toBeVisible();
    await page.goto("./#staff-settings");
    await expect(
      page.getByRole("heading", { name: "Staff access is required." }),
    ).toBeVisible();
    await expect(page.getByLabel("Find an account by email")).toHaveCount(0);
    expect(bankReads).toBe(0);
    expect(directoryReads).toBe(0);
    expect(backend.counts.assigns).toBe(0);
  });
