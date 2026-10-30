import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { groupedFixture, groupedState } from "./groupedReviewFixture";
import { file, coachId, id } from "./videoReviewFixture";
test("one three-clip review survives partial upload and refresh, starts one deadline and receives one private response", async ({
  page,
  context,
  browser,
}) => {
  const state = groupedState();
  await groupedFixture(context, state);
  await page.goto("./?source=app#workspace");
  await page
    .getByRole("button", { name: "Prepare a review", exact: true })
    .click();
  const compose = page.getByRole("dialog");
  await expect(compose).toContainText(
    "Review allowance is separate from storage capacity",
  );
  await expect(compose).not.toContainText("Four monthly reviews");
  await compose
    .getByLabel("Choose up to three review clips")
    .setInputFiles([file, file, file]);
  await expect(
    compose.getByLabel("Selected clip 3", { exact: true }),
  ).toBeVisible();
  await compose
    .getByRole("button", { name: "Upload review clips", exact: true })
    .dblclick();
  const current = page.getByRole("dialog");
  await expect(current.getByRole("alert")).toContainText(
    "Upload was not confirmed",
  );
  expect(state.groups.size).toBe(1);
  expect([...state.groups.values()][0].due_at).toBeNull();
  expect(state.counts.submits).toBe(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Open grouped review", exact: true })
    .click();
  const resumed = page.getByRole("dialog");
  // Exercise asynchronous file validation, including slower device/file reads.
  await page.evaluate(() => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return read.call(this);
    };
  });
  // setInputFiles does not wait for the asynchronous validation handler and can
  // set disabled inputs. Follow the same enabled/confirmed steps as a user.
  for (const ordinal of [2, 3]) {
    const input = resumed.getByLabel(`Choose clip ${ordinal} to resume`);
    await expect(input).toBeEnabled();
    await input.setInputFiles(file);
    await expect(
      page.getByText(`Clip ${ordinal} selected. Retry remaining uploads.`, {
        exact: true,
      }),
    ).toBeVisible();
  }
  await resumed
    .getByRole("button", { name: "Retry remaining uploads" })
    .click();
  await expect(
    resumed.getByRole("button", { name: "Send complete review" }),
  ).toBeEnabled();
  await resumed
    .getByRole("button", { name: "Send complete review" })
    .dblclick();
  await expect(resumed).toContainText("Ready for coach");
  expect(state.counts.creates).toBe(1);
  expect(state.counts.submits).toBe(1);
  const deadline = [...state.groups.values()][0].due_at;
  const coachContext = await browser.newContext({
    viewport: page.viewportSize() || { width: 390, height: 844 },
  });
  await groupedFixture(coachContext, state, "coach", coachId);
  const coach = await coachContext.newPage();
  await coach.goto(new URL("./?source=app#video-reviews", page.url()).href);
  await coach
    .getByRole("button", { name: "Open grouped review", exact: true })
    .click();
  const review = coach.getByRole("dialog");
  await expect(review.getByLabel("Private athlete practice video")).toHaveCount(
    3,
  );
  await review
    .getByLabel("Feedback for the complete review")
    .fill("Fictional response: reset your markers and use controlled steps.");
  await review
    .getByRole("button", { name: "Send one review response" })
    .dblclick();
  await expect(review).toHaveCount(0);
  expect(state.counts.feedback).toBe(1);
  expect([...state.groups.values()][0].due_at).toBe(deadline);
  await page.reload();
  await expect(
    page.getByText(
      "Fictional response: reset your markers and use controlled steps.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const strangerContext = await browser.newContext();
  await groupedFixture(strangerContext, state, "athlete", id(90));
  const stranger = await strangerContext.newPage();
  await stranger.goto(new URL("./?source=app#account", page.url()).href);
  const status = await stranger.evaluate(
    async (requestId) =>
      (
        await fetch(
          "https://separate-demo.supabase.co/rest/v1/rpc/review_group_detail",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request_id: requestId }),
          },
        )
      ).status,
    [...state.groups.keys()][0],
  );
  expect(status).toBe(403);
  await strangerContext.close();
  await coachContext.close();
});
test("canceled selection creates no service; group deletion is explicit and storage remains a finite account cap", async ({
  page,
  context,
}) => {
  const state = groupedState();
  state.failSecond = false;
  state.failCreateResponse = true;
  await groupedFixture(context, state);
  await page.goto("./?source=app#workspace");
  await page
    .getByRole("button", { name: "Prepare a review", exact: true })
    .click();
  let d = page.getByRole("dialog");
  await d
    .getByLabel("Choose up to three review clips")
    .setInputFiles([file, file, file, file]);
  await expect(d.getByRole("alert")).toContainText("at most three");
  await d.getByLabel("Choose up to three review clips").setInputFiles([]);
  await d.getByRole("button", { name: "Close preparation" }).click();
  expect(state.groups.size).toBe(0);
  await page
    .getByRole("button", { name: "Prepare a review", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByLabel("Choose up to three review clips")
    .setInputFiles([file, file, file]);
  await d
    .getByRole("button", { name: "Upload review clips", exact: true })
    .click();
  await expect(d.getByRole("alert")).toContainText("lost draft response");
  expect(state.groups.size).toBe(1);
  await d
    .getByRole("button", { name: "Upload review clips", exact: true })
    .click();
  expect(state.counts.creates).toBe(1);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Send complete review" }),
  ).toBeEnabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete grouped review", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep grouped review" }).click();
  expect([...state.groups.values()][0].clips).toHaveLength(3);
  await page
    .getByRole("button", { name: "Delete grouped review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete all grouped clips and feedback" })
    .dblclick();
  await expect(
    page.getByText("Grouped clips and feedback deleted.", { exact: true }),
  ).toBeVisible();
  expect([...state.groups.values()][0].clips).toHaveLength(0);
  expect(state.counts.submits).toBe(0);
});
