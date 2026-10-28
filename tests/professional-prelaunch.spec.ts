import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context, page }) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test("public conversion is packages and interest with one clearly fictional optional preview", async ({
  page,
}) => {
  await page.goto("./#home");
  const hero = page.locator(".hero");
  await expect(
    hero.getByRole("link", { name: "Explore packages" }),
  ).toHaveAttribute("href", "#membership");
  await expect(
    hero.getByRole("link", { name: "Express interest" }),
  ).toHaveAttribute("href", "?interest=1#membership");
  await expect(page.locator('main a[href="#demo"]')).toHaveCount(0);
  await expect(page.locator('footer a[href="#demo"]')).toHaveText(
    "Fictional preview",
  );
  await expect(hero).not.toContainText("private adult pilot");
  await expect(hero).toContainText("Membership enrollment is not open");
  const about = page.locator("#about-repformed");
  await expect(about).toContainText(
    "Repformed is building an online football learning and training platform",
  );
  await expect(about).toContainText(
    "Additional sports will be announced as programs develop",
  );
  await expect(
    page.getByRole("heading", { name: "More sports ahead." }),
  ).toHaveCount(0);
  await expect(
    page.locator("footer").getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("href", "#home");
  await hero.getByRole("link", { name: "Express interest" }).click();
  await expect(
    page.getByRole("heading", { name: "Interested? Tell us what fits." }),
  ).toBeFocused();
});
test("package progression remains readable at 375/390px and enlarged text without clipping", async ({
  page,
}, info) => {
  await page.goto("./#home");
  await mkdir("artifacts/professional-prelaunch", { recursive: true });
  for (const width of [375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const ladder = page.locator(".home-package-ladder");
    const positions = await ladder.getByRole("listitem").evaluateAll((items) =>
      items.map((e) => ({
        x: e.getBoundingClientRect().x,
        width: e.getBoundingClientRect().width,
      })),
    );
    expect(new Set(positions.map((r) => Math.round(r.x))).size).toBe(1);
    expect(positions.every((r) => r.width > 280)).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await ladder
        .locator("h3")
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThan(50);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const row of await ladder.getByRole("listitem").all())
      await expect(row).toBeVisible();
    await ladder.screenshot({
      path: `artifacts/professional-prelaunch/packages-${width}-enlarged-${info.project.name}.png`,
      style: "header,.app-tabs{visibility:hidden !important}",
    });
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("font-size");
    });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `artifacts/professional-prelaunch/home-${info.project.name}.png`,
    fullPage: true,
  });
});
test("help scopes operational pilot review limits separately from proposed Elite terms", async ({
  page,
}) => {
  await page.goto("./#contact");
  await page
    .getByText("How do private video reviews work?", { exact: true })
    .click();
  await expect(
    page.getByText(/For the current private adult pilot/),
  ).toBeVisible();
  await expect(
    page.getByText(/current pilot target is 48 consecutive hours/),
  ).toBeVisible();
  await expect(page.getByText(/three-business-day target/)).toBeVisible();
  await page
    .getByText("What should I check if my video will not upload?", {
      exact: true,
    })
    .click();
  await expect(page.getByText(/current 60-second clip limit/)).toBeVisible();
  for (const link of await page
    .getByRole("link", { name: "Compare planned package terms" })
    .all())
    await expect(link).toHaveAttribute("href", "#membership");
});
test("web-app entry/help use account language and keep TestFlight guidance out of public primary navigation", async ({
  page,
}) => {
  await page.goto("./?source=app#app");
  await expect(page.locator(".app-build-label")).toHaveText("ACCOUNT ACCESS");
  await expect(page.getByRole("main")).not.toContainText("adult pilot");
  await page.goto("./?source=app#app-help");
  await expect(page.getByRole("main")).toContainText("REPFORMED · APP HELP");
  await expect(
    page.getByRole("heading", { name: "Try the complete phone test." }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /two-phone test guide/ }),
  ).toHaveCount(0);
  await page.goto("./#install");
  await expect(
    page.getByRole("link", { name: "Open the member app" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "Approved account records use the private account service",
  );
  await expect(page.getByRole("main")).not.toContainText("fictional-data test");
});
