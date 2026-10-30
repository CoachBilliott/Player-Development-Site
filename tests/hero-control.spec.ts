import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => disableBackend(context));
test("hero playback remains accessible without a prominent text button in the copy", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./#home");
  const hero = page.locator(".hero");
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await hero.screenshot({ path: info.outputPath("hero-control.png") });
  await expect(hero.locator(".hero-copy .hero-motion-control")).toHaveCount(0);
  const pause = hero.getByRole("button", {
    name: "Pause background video",
    exact: true,
  });
  await expect(pause).toHaveText("");
  const box = await pause.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeLessThanOrEqual(48);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await pause.focus();
  await page.keyboard.press("Space");
  await expect(
    hero.getByRole("button", { name: "Resume background video", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      hero.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(true);
  await page.keyboard.press("Space");
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  expect(
    (await new AxeBuilder({ page }).include(".hero").analyze()).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
