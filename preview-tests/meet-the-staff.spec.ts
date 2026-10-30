import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [320, 390, 768, 1440]) {
  test(`staff layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Meet the staff",
    );
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByText("Headshot pending")).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const cards = await page.getByRole("article").all();
    const first = await cards[0].boundingBox();
    const second = await cards[1].boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (width < 720)
      expect(second!.y).toBeGreaterThan(first!.y + first!.height);
    else expect(second!.y).toBe(first!.y);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `artifacts/meet-the-staff/staff-${width}.png`,
      fullPage: true,
    });
  });
}
test("additional staff wrap cleanly without account data or network clients", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const modulePath = "/main.tsx";
    const { renderGrowthFixture } = await import(/* @vite-ignore */ modulePath);
    renderGrowthFixture();
  });
  await expect(page.getByRole("article")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
