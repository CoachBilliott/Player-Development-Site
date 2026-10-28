import { openAssignment } from "./workoutFixture";
import { test, expect } from "@playwright/test";
import {
  fixture,
  state,
  uid,
  accountId,
  profileId,
  staffId,
} from "./workoutFixture";

test("Owner assigns distinct sibling plans; parent completion, selection and history stay separate after refresh", async ({
  page,
  context,
  browser,
}) => {
  const backend = state(),
    sibling = uid(4);
  backend.profiles.push({
    ...backend.profiles[0],
    id: sibling,
    nickname: "Fictional Sibling",
    position: "Defensive back",
  });
  for (const [id, title, resource] of [
    [uid(20), "Fictional footwork plan", uid(10)],
    [uid(21), "Fictional ball skills plan", uid(11)],
  ])
    backend.workouts.set(id, {
      id,
      title,
      summary: "Illustrative adult-only fixture.",
      resource_ids: [resource],
      created_by: staffId,
      version: 1,
      updated_at: new Date().toISOString(),
    });
  await fixture(context, backend);
  await page.goto("./?source=app#workout-builder");
  await page.getByRole("button", { name: /Fictional footwork plan/ }).click();
  await openAssignment(page);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await expect(
    page.getByRole("button", { name: "Preview assignment" }),
  ).toHaveCount(0);
  await page.getByLabel("Assign to athlete").selectOption(profileId);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await expect(page.getByRole("dialog")).toContainText("Fictional Pilot");
  await page.getByRole("button", { name: "Keep current assignment" }).click();
  expect(backend.profileAssignments.size).toBe(0);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Choose a different workout" })
    .click();
  await page
    .getByRole("button", { name: /Fictional ball skills plan/ })
    .click();
  await openAssignment(page);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await page.getByLabel("Assign to athlete").selectOption(sibling);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await expect(page.getByRole("dialog")).toContainText("Fictional Sibling");
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.counts.assigns).toBe(2);
  expect(backend.profileAssignments.get(profileId)?.resource_ids).toEqual([
    uid(10),
  ]);
  expect(backend.profileAssignments.get(sibling)?.resource_ids).toEqual([
    uid(11),
  ]);
  const parent = await browser.newContext({
    viewport: page.viewportSize() || { width: 390, height: 844 },
  });
  await fixture(parent, backend, "parent");
  const customer = await parent.newPage();
  await customer.goto(new URL("./?source=app#today", page.url()).href);
  for (const [p, title] of [
    [profileId, "Fictional footwork plan"],
    [sibling, "Fictional ball skills plan"],
  ]) {
    await customer
      .getByLabel("Training athlete", { exact: true })
      .selectOption(p);
    await customer.reload();
    await expect(
      customer.getByLabel("Training athlete", { exact: true }),
    ).toHaveValue(p);
    await expect(
      customer.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await customer
      .getByRole("button", { name: "Guide and record practice" })
      .click();
    const session = customer.getByRole("dialog");
    await session.getByRole("checkbox").check();
    await session
      .getByRole("button", { name: "Begin workout", exact: true })
      .click();
    await session
      .getByRole("button", { name: "Finish workout", exact: true })
      .dblclick();
    await expect(session).toHaveCount(0);
  }
  expect(backend.reports.map((r) => r.profile_id)).toEqual([
    profileId,
    sibling,
  ]);
  expect(backend.counts.reports).toBe(2);
  await customer.goto(new URL("./?source=app#app-progress", page.url()).href);
  await expect(
    customer.getByRole("heading", {
      name: "Fictional ball skills plan",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    customer.getByRole("heading", {
      name: "Fictional footwork plan",
      exact: true,
    }),
  ).toHaveCount(0);
  await customer
    .getByLabel("Training athlete", { exact: true })
    .selectOption(profileId);
  await expect(
    customer.getByRole("heading", {
      name: "Fictional footwork plan",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    customer.getByRole("heading", {
      name: "Fictional ball skills plan",
      exact: true,
    }),
  ).toHaveCount(0);
  await parent.close();
});
