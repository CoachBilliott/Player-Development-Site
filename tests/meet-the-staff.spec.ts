import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";

test.beforeEach(async ({ context, page }) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
});
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`staff page preserves profiles, photo quality and responsive order at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const writes: string[] = [];
    page.on("request", (r) => {
      if (["POST", "PATCH", "PUT", "DELETE"].includes(r.method()))
        writes.push(r.url());
    });
    await page.goto("./#staff");
    const main = page.locator(".meet-staff");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "Meet the staffPurpose in every rep.",
    );
    const cards = main.getByRole("article");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAccessibleName("Victor Bennett");
    await expect(cards.nth(1)).toHaveAccessibleName("Devyn Billiott");
    await expect(
      cards.nth(0).getByText("Owner", { exact: true }),
    ).toBeVisible();
    await expect(
      cards.nth(1).getByText("Co-Owner", { exact: true }),
    ).toBeVisible();
    await expect(cards.nth(0).locator(".staff-bio")).toContainText(
      "more than 20 years",
    );
    await expect(cards.nth(1).locator(".staff-bio")).toContainText(
      "four years",
    );
    await expect(
      main.getByText(
        /pending|placeholder|preview|not published|questionnaire|verified experience/i,
      ),
    ).toHaveCount(0);
    for (let i = 0; i < 2; i++) {
      const image = cards.nth(i).getByRole("img");
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        )
        .toBe(true);
      expect(
        await image.evaluate((img: HTMLImageElement) => ({
          width: img.naturalWidth,
          height: img.naturalHeight,
          enlarged: img.clientWidth > img.naturalWidth,
        })),
      ).toEqual(
        i === 0
          ? { width: 942, height: 1536, enlarged: false }
          : { width: 1067, height: 1600, enlarged: false },
      );
    }
    const first = await cards.nth(0).boundingBox(),
      second = await cards.nth(1).boundingBox();
    if (width < 720)
      expect(second!.y).toBeGreaterThan(first!.y + first!.height);
    else expect(second!.y).toBe(first!.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0, 0));
    if (testInfo.project.name === "desktop")
      await page.screenshot({
        path: `artifacts/meet-the-staff/production-${width}.png`,
        fullPage: true,
      });
  });
}
test("About link, navigation and footer reach staff with route heading focus", async ({
  page,
}) => {
  await page.goto("./#home");
  const link = page
    .locator("#about-repformed")
    .getByRole("link", { name: "Meet the staff" });
  await link.click();
  await expect(page).toHaveURL(/#staff$/);
  await expect(page.locator(".meet-staff h1")).toBeFocused();
  await expect(
    page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: "Meet the staff" }),
  ).toHaveAttribute("href", "#staff");
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(
      page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link", { name: "Meet the staff" }),
    ).toBeVisible();
  } else {
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Meet the staff" }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(page.locator(".meet-staff h1")).toBeVisible();
});
