import { disableBackend } from "./backendFixture";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await disableBackend(context);
});

test("athlete illustration responds to themes, replay, and pause without recording practice", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const shell = page.locator(".experience");
  await expect(shell).toHaveAttribute("data-motion", "running");
  await expect(page.locator(".athlete-sculpture animateMotion")).toHaveCount(1);
  const route = await page.locator(".athlete-lane").getAttribute("d");
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Focus", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("img", {
      name: /Original decorative athlete-development illustration: focus/,
    }),
  ).toBeVisible();
  expect(await page.locator(".athlete-lane").getAttribute("d")).not.toBe(route);
  await page.evaluate(() => document.fonts.ready);
  // A replay must restart even late in the SVG document timeline.
  await page.locator(".athlete-sculpture").evaluate((svg) => {
    (svg as SVGSVGElement).setCurrentTime(20);
  });
  await page.getByRole("button", { name: "Replay athlete animation" }).click();
  await expect(page.locator(".athlete-sculpture animateMotion")).toHaveCount(1);
  const marker = page.locator(".athlete-marker circle");
  const firstPosition = await marker.boundingBox();
  if (!firstPosition)
    throw new Error("The decorative animated marker is missing.");
  await expect
    .poll(async () => {
      const current = await marker.boundingBox();
      return current
        ? Math.hypot(current.x - firstPosition.x, current.y - firstPosition.y)
        : 0;
    })
    .toBeGreaterThan(16);
  await page
    .getByRole("button", { name: "Motion on: pause animations", exact: true })
    .click();
  await expect(shell).toHaveAttribute("data-motion", "paused");
  await expect(page.locator(".athlete-sculpture animateMotion")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Replay athlete animation" }),
  ).toBeDisabled();
  expect(
    await page
      .locator(".athlete-figure")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.reload();
  await expect(shell).toHaveAttribute("data-motion", "paused");
  expect(
    await page.evaluate(() => localStorage.getItem("pd-demo-v1")),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Motion off: play animations", exact: true })
    .click();
  await expect(shell).toHaveAttribute("data-motion", "running");
  await expect(page.locator(".athlete-sculpture animateMotion")).toHaveCount(1);
  const reveal = page.locator(".reveal").last();
  await reveal.scrollIntoViewIfNeeded();
  await expect(reveal).toHaveAttribute("data-visible", "true");
});

test("device reduced motion gives a static, usable training experience", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect(
    page.getByRole("button", {
      name: "Motion off: reduced-motion preference",
    }),
  ).toBeDisabled();
  await expect(page.locator(".athlete-sculpture animateMotion")).toHaveCount(0);
  expect(
    await page
      .locator(".athlete-figure")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  for (const reveal of await page.locator(".reveal").all())
    expect(await reveal.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1",
    );
  await page
    .getByRole("main")
    .getByRole("link", { name: "Try the demo", exact: true })
    .click();
  await page.getByRole("button", { name: "Solo athlete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Morgan’s workouts", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start sample workout", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Begin sample practice" }).click();
  await expect(
    page.getByRole("button", { name: "Show workout steps" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".page-transition")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.reload();
  await page.getByRole("button", { name: "Solo athlete", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("No workouts recorded for this athlete yet."),
  ).toBeVisible();
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-motion",
    "paused",
  );
});
