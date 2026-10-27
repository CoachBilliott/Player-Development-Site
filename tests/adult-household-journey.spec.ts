import { expect, test } from "@playwright/test";
import { coachId, fixture, file, userId } from "./videoReviewFixture";

// Approved adult household only. Invitation/profile creation and closed junior gates
// have separate acceptance tests; these contexts never contact the live project.
test("approved adult household completes assigned practice, receives private coach feedback and retains progress", async ({
  page,
  context,
  browser,
}) => {
  const household = await fixture(context, "parent", false, 2, true);
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("heading", {
      name: "Today’s training.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Guide and record practice", exact: true })
    .click();
  const practice = page.getByRole("dialog");
  await practice.getByRole("checkbox").check();
  await practice.getByRole("button", { name: "Begin workout" }).click();
  await expect(practice.getByText("Set two markers.")).toBeVisible();
  await practice
    .getByRole("button", { name: "Complete drill · Next", exact: true })
    .click();
  await expect(
    practice.getByRole("heading", {
      name: "Fictional next drill 2",
      exact: true,
    }),
  ).toBeVisible();
  // Separate intentional drill completion from the repeated-tap coalescing window.
  await page.waitForTimeout(700);
  await practice
    .getByRole("button", { name: "Finish workout", exact: true })
    .dblclick();
  await expect(practice).toHaveCount(0);
  expect(household.counts.reports).toBe(1);
  expect(household.workouts).toHaveLength(1);
  expect(household.workouts[0].status).toBe("approved");
  expect(household.workouts[0].drill_ids).toHaveLength(2);

  await page.getByRole("button", { name: "Send a drill video" }).click();
  const video = page.getByRole("dialog");
  await video.getByLabel("Choose drill video").setInputFiles(file);
  await expect(video.getByLabel("Your video preview")).toBeVisible();
  await video
    .getByRole("button", { name: "Send for coach review", exact: true })
    .dblclick();
  await expect(video).toHaveCount(0);
  expect(household.rows).toHaveLength(1);
  expect(household.counts.uploads).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Sent for coach review", { exact: true }),
  ).toBeVisible();

  const coachContext = await browser.newContext();
  try {
    const coach = await fixture(
      coachContext,
      "coach",
      false,
      2,
      false,
      coachId,
    );
    // Both mocked clients refer to one server-side submission; identities stay distinct.
    coach.rows.push(...household.rows);
    const staff = await coachContext.newPage();
    await staff.goto("./?source=app#video-reviews");
    const staffIdentity = await staff.evaluate(
      () =>
        JSON.parse(localStorage.getItem("sb-separate-demo-auth-token")!).user
          .id,
    );
    expect(staffIdentity).toBe(coachId);
    expect(staffIdentity).not.toBe(userId);
    await staff.getByRole("button", { name: "Open review" }).click();
    await expect(
      staff.getByLabel("Private athlete practice video"),
    ).toBeVisible();
    await staff
      .getByLabel("Coaching feedback")
      .fill("Keep the walking steps controlled and reset between repetitions.");
    await staff
      .getByRole("button", { name: "Send coaching feedback" })
      .dblclick();
    await expect(staff.getByRole("dialog")).toHaveCount(0);
    expect(coach.counts.feedback).toBe(1);
  } finally {
    await coachContext.close();
  }

  await page.reload();
  await expect(
    page.getByText(
      "Keep the walking steps controlled and reset between repetitions.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Progress", exact: true })
    .click();
  await expect(page.locator(".family-workout")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".family-workout")).toHaveCount(1);
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
});
