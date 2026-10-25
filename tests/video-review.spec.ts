import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  fixture,
  id,
  userId,
  playerId,
  drillId,
  file,
  content,
  media,
  coachId,
} from "./videoReviewFixture";
test("real drill viewer shows media and all steps together and records one completion", async ({
  page,
  context,
}) => {
  const backend = await fixture(context);
  await page.goto("./?source=app#workspace");
  await expect(page.locator('a[href="#demo"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Begin workout" }).click();
  await expect(d.getByText("Set two markers.")).toBeVisible();
  await expect(d.locator("video")).toBeVisible();
  await expect(
    d.getByRole("button", { name: "Show workout steps" }),
  ).toHaveCount(0);
  await d.getByRole("button", { name: "Finish workout" }).dblclick();
  await expect(d).toHaveCount(0);
  expect(backend.counts.reports).toBe(1);
});
test("recording can be canceled and unsupported files never upload", async ({
  page,
  context,
}) => {
  const backend = await fixture(context);
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Send a drill video" }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Record drill video")).toHaveAttribute(
    "capture",
    "environment",
  );
  await d.getByLabel("Choose drill video").setInputFiles({
    name: "bad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a video"),
  });
  await expect(d.getByRole("alert")).toContainText("MP4, MOV or WebM");
  await d.getByLabel("Choose drill video").setInputFiles([]);
  await d.getByRole("button", { name: "Cancel video", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(backend.counts.uploads).toBe(0);
  expect(backend.rows).toHaveLength(0);
});
test("video preview, repeated send clicks and refresh preserve exactly one private submission", async ({
  page,
  context,
}, info) => {
  const backend = await fixture(context);
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Send a drill video" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Choose drill video").setInputFiles(file);
  await expect(d.getByLabel("Your video preview")).toBeVisible();
  await page.screenshot({
    path: `artifacts/video-preview-${info.project.name}.png`,
  });
  await d
    .getByRole("button", { name: "Send for coach review", exact: true })
    .dblclick();
  await expect(d).toHaveCount(0);
  await expect(
    page.getByText("Sent for coach review", { exact: true }),
  ).toBeVisible();
  expect(backend.rows).toHaveLength(1);
  expect(backend.counts.uploads).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Sent for coach review", { exact: true }),
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
test("failed upload retries the same submission and deletion requires confirmation", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "athlete", true);
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Send a drill video" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Choose drill video").setInputFiles(file);
  await d
    .getByRole("button", { name: "Send for coach review", exact: true })
    .click();
  await expect(d.getByRole("alert")).toContainText("not confirmed");
  await d
    .getByRole("button", { name: "Retry sending video", exact: true })
    .click();
  await expect(d).toHaveCount(0);
  expect(backend.rows).toHaveLength(1);
  expect(backend.counts.uploads).toBe(2);
  await page.getByRole("button", { name: "Delete video", exact: true }).click();
  await page.getByRole("button", { name: "Keep video" }).click();
  expect(backend.counts.deletes).toBe(0);
  await page.getByRole("button", { name: "Delete video", exact: true }).click();
  await page.getByRole("button", { name: "Delete video permanently" }).click();
  await expect(
    page.getByText("Sent for coach review", { exact: true }),
  ).toHaveCount(0);
  expect(backend.rows).toHaveLength(0);
  expect(backend.counts.deletes).toBe(1);
});
test("assigned coach can open a private clip and save feedback once", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "coach");
  backend.rows.push({
    id: id(40),
    profile_id: playerId,
    account_id: userId,
    submitted_by: userId,
    resource_id: drillId,
    drill_title: content.title,
    asset_path: `${userId}/${playerId}/${id(40)}.webm`,
    media_type: "video/webm",
    byte_size: media.length,
    duration_seconds: 1,
    status: "queued",
    feedback: "",
    created_at: new Date().toISOString(),
    version: 2,
  });
  await page.goto("./?source=app#video-reviews");
  await page.getByRole("button", { name: "Open review" }).click();
  await expect(page.getByLabel("Private athlete practice video")).toBeVisible();
  await page
    .getByLabel("Coaching feedback")
    .fill("Keep your steps controlled and repeat at walking pace.");
  await page.getByRole("button", { name: "Send coaching feedback" }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.counts.feedback).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Coach feedback ready", { exact: true }),
  ).toBeVisible();
});
test("Owner can separately assign workouts and optional review access without charging", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "owner");
  await page.goto("./?source=app#access");
  const panel = page.getByRole("region", {
    name: "Workout and video package access",
  });
  await panel.getByLabel("Customer account").selectOption(userId);
  await panel.getByLabel("Fictional assigned footwork").check();
  await panel.getByLabel("Enable the optional video review feature").check();
  await panel.getByLabel("Assigned review coach").selectOption(coachId);
  await panel.getByRole("button", { name: "Review training access" }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  expect(backend.counts.access).toBe(0);
  await panel.getByRole("button", { name: "Review training access" }).click();
  await page
    .getByRole("button", { name: "Save training access", exact: true })
    .dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.counts.access).toBe(1);
});

test("multi-drill practice shows the order and next activity, allows review, and never treats playback or canceled practice as completion", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "athlete", false, 3);
  await page.goto("./?source=app#workspace");
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("list", { name: "Workout order" }).getByRole("listitem"),
  ).toHaveCount(3);
  await expect(
    dialog.getByText("Paper marker 3", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Begin workout" }).click();
  await expect(
    dialog.getByRole("heading", { name: content.title, exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByRole("progressbar", { name: "Current drill position" }),
  ).toHaveAttribute("value", "1");
  await expect(dialog.locator(".next-drill")).toContainText(
    "Fictional next drill 2",
  );
  await page.screenshot({
    path: `artifacts/guided-drill-${page.viewportSize()?.width}.png`,
  });
  await expect(dialog.locator("video")).toHaveAttribute("playsinline", "");
  await dialog
    .locator("video")
    .evaluate((el) => el.dispatchEvent(new Event("ended")));
  expect(backend.counts.reports).toBe(0);
  await dialog
    .getByRole("button", { name: "Complete drill · Next" })
    .dblclick();
  await expect(
    dialog.getByRole("heading", {
      name: "Fictional next drill 2",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("value", "2");
  await expect(
    dialog.getByText("Read marker 2.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Set two markers.", { exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      dialog.getByRole("button", { name: "Previous drill" }).isEnabled(),
    )
    .toBe(true);
  // A fresh intentional action follows the guard that coalesces repeated taps.
  await page.waitForTimeout(700);
  await dialog.getByRole("button", { name: "Previous drill" }).click();
  await expect(
    dialog.getByRole("heading", { name: content.title, exact: true }),
  ).toBeFocused();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("value", "1");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep practicing" }).click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "End workout", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Discard unfinished workout" })
    .click();
  expect(backend.counts.reports).toBe(0);
  await page.reload();
  expect(backend.counts.reports).toBe(0);
});
