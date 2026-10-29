import { disableBackend } from "./backendFixture";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ context }) => disableBackend(context));
test("background footage loops silently and can be paused and resumed from the keyboard", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const film = page.locator(".hero-training-video");
  await film.scrollIntoViewIfNeeded();
  await expect(film).toHaveClass(/is-playing/);
  await expect(film).toHaveJSProperty("muted", true);
  await expect(film).toHaveJSProperty("loop", true);
  await expect(film).toHaveJSProperty("controls", false);
  await expect(film).toHaveAttribute("playsinline", "");
  const pause = page.getByRole("button", {
    name: "Pause background video",
    exact: true,
  });
  await pause.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Resume background video", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => film.evaluate((el: HTMLVideoElement) => el.paused))
    .toBe(true);
  await page.keyboard.press("Space");
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".athlete-sculpture")).toHaveCount(0);
  await expect
    .poll(() =>
      film.evaluate((el: HTMLVideoElement) => !el.paused && el.readyState >= 2),
    )
    .toBe(true);
  await film.evaluate((el: HTMLVideoElement) => {
    el.currentTime = el.duration - 0.2;
  });
  await expect
    .poll(() => film.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeLessThan(1.5);
  await expect
    .poll(() => film.evaluate((el: HTMLVideoElement) => !el.paused))
    .toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("pd-family-demo-v1")),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("pd-demo-v1")),
  ).toBeNull();
  await page.reload();
  await page.locator(".hero-training-video").scrollIntoViewIfNeeded();
  await expect(page.locator(".hero-training-video")).toHaveClass(/is-playing/);
});
test("device reduced motion automatically shows a real still with no motion buttons and usable training", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect(page.locator(".hero-training-video")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /background video/ }),
  ).toHaveCount(0);
  await expect(page.locator(".training-poster")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /replay|pause animations|motion off|motion on|reduce motion/i,
    }),
  ).toHaveCount(0);
  for (const reveal of await page.locator(".reveal").all())
    expect(await reveal.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1",
    );
  await page
    .locator("footer")
    .getByRole("link", { name: "Fictional preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Solo athlete", exact: true }).click();
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
});
test("unavailable hero videos retain a real poster and never block the website or demo", async ({
  page,
  context,
}) => {
  await context.route("**/media/training-loop.*", (route) =>
    route.abort("failed"),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  await expect(page.locator(".training-poster")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".training-poster")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", {
      name: /replay|pause animations|motion off|motion on|reduce motion/i,
    }),
  ).toHaveCount(0);
  await page
    .locator("footer")
    .getByRole("link", { name: "Fictional preview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Explore fictional practice." }),
  ).toBeVisible();
});

test("WebM footage plays if the MP4 request is unavailable", async ({
  page,
  context,
}) => {
  await context.route("**/media/training-loop.mp4", (route) =>
    route.abort("failed"),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const film = page.locator(".hero-training-video");
  await film.scrollIntoViewIfNeeded();
  await expect(film).toHaveClass(/is-playing/);
  await expect
    .poll(() => film.evaluate((el: HTMLVideoElement) => el.currentSrc))
    .toMatch(/training-loop\.webm$/);
  await expect
    .poll(() =>
      film.evaluate((el: HTMLVideoElement) => !el.paused && el.readyState >= 2),
    )
    .toBe(true);
});
