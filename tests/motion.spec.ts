import { test, expect } from "@playwright/test";

test("field illustration responds to focus, replay, and pause without recording practice", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const shell = page.locator(".experience");
  await expect(shell).toHaveAttribute("data-motion", "running");
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(1);
  const route = await page.locator(".route-trace").getAttribute("d");
  await page.getByRole("button", { name: "Field vision", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Field vision", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("img", {
      name: /Original illustrative football field showing a path toward open space/,
    }),
  ).toBeVisible();
  expect(await page.locator(".route-trace").getAttribute("d")).not.toBe(route);
  await page.evaluate(() => document.fonts.ready);
  // A replay must restart even after the SVG document timeline has finished a route.
  await page.locator(".stadium-surface svg").evaluate((svg) => {
    (svg as SVGSVGElement).setCurrentTime(20);
  });
  await page.getByRole("button", { name: "Replay field animation" }).click();
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(1);
  const marker = page.locator(".field-activity circle");
  const firstPosition = await marker.boundingBox();
  if (!firstPosition) throw new Error("The animated field marker is missing.");
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
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Replay field animation" }),
  ).toBeDisabled();
  expect(
    await page
      .locator(".stadium-surface")
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
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(1);
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
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(0);
  expect(
    await page
      .locator(".stadium-surface")
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
  await page.getByRole("button", { name: /Morgan/ }).click();
  await page.getByRole("button", { name: "See my training" }).click();
  await expect(
    page.getByRole("heading", { name: "Today’s training", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start today’s session" }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Begin guided session" }).click();
  await expect(
    page.getByRole("button", { name: "Show practice steps" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".page-transition")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Show practice steps" }),
  ).toBeVisible();
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-motion",
    "paused",
  );
});
