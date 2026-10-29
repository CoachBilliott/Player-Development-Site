import { test, expect } from "@playwright/test";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => disableBackend(context));
test("skip link is the first keyboard stop and moves focus without changing route", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#home");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", {
    name: "Skip to main content",
    exact: true,
  });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page).toHaveURL(/#home$/);
  await expect(
    page.getByRole("heading", { name: /Know the game/ }),
  ).toBeVisible();
});
test("interest privacy has a linked brand and top return navigation without changing its notice", async ({
  page,
}) => {
  await page.goto("./interest-privacy.html");
  const header = page.getByRole("banner");
  await expect(
    header.getByRole("link", { name: "Repformed home" }),
  ).toHaveAttribute("href", "./#home");
  await expect(
    page.getByRole("heading", { name: "Your interest. Your information." }),
  ).toBeVisible();
  await header
    .getByRole("link", { name: "Back to packages", exact: true })
    .click();
  await expect(page).toHaveURL(/#membership$/);
  await expect(
    page.getByRole("heading", {
      name: "Choose the support your athlete needs.",
    }),
  ).toBeVisible();
});

test("motion control remains readable and separate from hero actions on narrow screens", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./#home");
  for (const width of [320, 375, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const control = page.getByRole("button", {
      name: "Pause background video",
      exact: true,
    });
    await expect(control).toBeVisible();
    const button = await control.boundingBox();
    const next = await page
      .getByRole("button", { name: "See how it works", exact: true })
      .boundingBox();
    const hero = await page.locator(".hero").boundingBox();
    expect(button!.width).toBeGreaterThan(160);
    expect(button!.height).toBeGreaterThanOrEqual(44);
    expect(button!.y + button!.height).toBeLessThanOrEqual(next!.y);
    expect(button!.y + button!.height).toBeLessThanOrEqual(
      hero!.y + hero!.height,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const { mkdir } = await import("node:fs/promises");
  await mkdir("artifacts/public-accessibility", { recursive: true });
  await page.setViewportSize({
    width: info.project.name === "phone" ? 390 : 1440,
    height: 900,
  });
  await page.screenshot({
    path: `artifacts/public-accessibility/hero-${info.project.name}.png`,
  });
});
