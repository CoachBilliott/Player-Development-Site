import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const config = {
  enabled: true,
  url: "https://separate-demo.supabase.co",
  publishableKey: "sb_publishable_fixture_only",
  membersEnabled: true,
  membersSignupEnabled: false,
  interestIntakeEnabled: true,
};
test.beforeEach(async ({ context }) => {
  await context.route("https://separate-demo.supabase.co/**", (r) =>
    r.fulfill({ json: [] }),
  );
});

test("pending configuration shows status, never a misleading email-app action", async ({
  page,
  context,
}, info) => {
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await context.route("**/content-config.json", async (r) => {
    await gate;
    await r.fulfill({ json: config });
  });
  await page.goto("./#membership");
  const section = page.locator("#package-interest");
  await expect(section.getByRole("status")).toHaveText(
    "Loading interest form…",
  );
  await expect(
    section.getByRole("link", { name: "Email package interest" }),
  ).toHaveCount(0);
  await expect(section.getByRole("combobox")).toHaveCount(0);
  await expect(
    section.getByRole("button", { name: "Send interest", exact: true }),
  ).toHaveCount(0);
  await section.getByRole("heading").focus();
  expect(
    (await new AxeBuilder({ page }).include("#package-interest").analyze())
      .violations,
  ).toEqual([]);
  await mkdir("artifacts/public-ux-fixes", { recursive: true });
  await section.screenshot({
    path: `artifacts/public-ux-fixes/intake-loading-${info.project.name}.png`,
  });
  release();
  await expect(
    section.getByRole("form", { name: "Send adult package interest" }),
  ).toBeVisible();
  await expect(section.getByRole("heading")).toBeFocused();
  await expect(section.getByText("Loading interest form…")).toHaveCount(0);
  await expect(
    section.getByRole("link", { name: "Email package interest" }),
  ).not.toBeVisible();
  await section.screenshot({
    path: `artifacts/public-ux-fixes/intake-ready-${info.project.name}.png`,
  });
});

for (const outcome of ["disabled", "error", "malformed"] as const) {
  test(`settled ${outcome} configuration offers honest manual fallback`, async ({
    page,
    context,
  }) => {
    await context.route("**/content-config.json", (r) =>
      outcome === "error"
        ? r.fulfill({ status: 503, body: "Unavailable" })
        : r.fulfill({
            json:
              outcome === "disabled"
                ? { ...config, interestIntakeEnabled: false }
                : { enabled: true },
          }),
    );
    await page.goto("./#membership");
    const section = page.locator("#package-interest");
    await expect(
      section.getByRole("link", { name: "Email package interest" }),
    ).toBeVisible();
    await expect(section).toContainText("This opens your email app");
    await expect(section).toContainText("website does not submit, store");
    await expect(section.getByText("Loading interest form…")).toHaveCount(0);
    await expect(
      section.getByRole("button", { name: "Send interest", exact: true }),
    ).toHaveCount(0);
  });
}

test("configuration deadline settles to fallback without reloading or losing device state", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await context.route("**/content-config.json", () => {});
  await page.goto("./#membership");
  const section = page.locator("#package-interest");
  await expect(section.getByRole("status")).toHaveText(
    "Loading interest form…",
  );
  await page.evaluate(() =>
    sessionStorage.setItem("fixture-unsaved", "preserved"),
  );
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.clock.fastForward(15001);
  await expect(
    section.getByRole("link", { name: "Email package interest" }),
  ).toBeVisible();
  expect(navigations).toBe(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("fixture-unsaved")),
  ).toBe("preserved");
});
