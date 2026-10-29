import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { disableBackend } from "./backendFixture";

test.beforeEach(async ({ context, page }) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test("home connects the four shared package stages to learning, practice and parent visibility", async ({
  page,
}) => {
  await page.goto("./#home");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Know the game.Own your rep.",
  );
  const ladder = page.locator(".home-package-ladder");
  await expect(ladder.getByRole("heading", { level: 3 })).toHaveText([
    "Foundation",
    "Fundamentals",
    "Position Development",
    "Elite Coaching",
  ]);
  const stages = ladder.getByRole("listitem");
  await expect(stages.nth(0)).toContainText(
    "2 football-IQ videos per week · no drills",
  );
  await expect(stages.nth(1)).toContainText(
    "2 IQ + 2 fundamental drill videos per week",
  );
  await expect(stages.nth(2)).toContainText(
    "Position work replaces or adapts the two drills",
  );
  await expect(stages.nth(3)).toContainText("2 chosen video reviews per month");
  await expect(stages.nth(3)).toContainText(
    "Written feedback · up to three minutes of footage per review",
  );
  await expect(page.locator(".practice-intro")).toContainText(
    "Proposed drill packages would release content on Sundays",
  );
  await expect(page.locator(".athlete-paths")).toContainText(
    "parent-managed approach connects lessons, practice history and athlete permissions",
  );
  await expect(
    page.getByRole("button", { name: /buy|checkout|enroll|subscribe/i }),
  ).toHaveCount(0);
});
test("hero compares proposals while express interest opens and focuses the existing email section", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PATCH", "PUT"].includes(r.method())) writes.push(r.url());
  });
  await page.goto("./#home");
  const primary = page
    .locator(".hero")
    .getByRole("link", { name: "Explore packages" });
  await expect(primary).toBeInViewport();
  await primary.click();
  await expect(page).toHaveURL(/#membership$/);
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.goto("./#home");
  await page
    .locator(".hero")
    .getByRole("link", { name: "Express interest", exact: true })
    .click();
  const interest = page.getByRole("heading", {
    name: "Interested? Tell us what fits.",
  });
  await expect(interest).toBeFocused();
  await expect(interest).toBeInViewport();
  await expect(page).toHaveURL(/#membership$/);
  expect(new URL(page.url()).searchParams.has("interest")).toBe(false);
  await page
    .getByLabel("Package you’re interested in")
    .selectOption("foundation");
  const link = new URL(
    (await page
      .getByRole("link", { name: "Email package interest" })
      .getAttribute("href"))!,
  );
  expect(link.pathname).toBe("Repformed@gmail.com");
  expect(link.searchParams.get("body")).toContain(
    "Interested package: Foundation",
  );
  await expect(
    page.getByRole("button", { name: "Copy email address" }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});
test("interest intent consumes only its own query flag and remains a usable route after refresh", async ({
  page,
}) => {
  await page.goto("./?ref=partner&interest=1#membership");
  await expect(
    page.getByRole("heading", { name: "Interested? Tell us what fits." }),
  ).toBeFocused();
  expect(new URL(page.url()).searchParams.get("ref")).toBe("partner");
  expect(new URL(page.url()).searchParams.has("interest")).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "A path for the next step." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share your interest" }).click();
  await expect(
    page.getByRole("heading", { name: "Interested? Tell us what fits." }),
  ).toBeFocused();
});
test("home is readable on narrow screens, accessible, honest about availability and retains working demo", async ({
  page,
}, info) => {
  await page.goto("./#home");
  await expect(page.locator(".home-availability")).toBeInViewport();
  await expect(page.locator(".home-availability")).toContainText(
    "Membership enrollment is not open",
  );
  const widths = info.project.name === "phone" ? [320, 390] : [768, 1440];
  for (const width of widths) {
    await page.setViewportSize({
      width,
      height: info.project.name === "phone" ? 844 : 1000,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.html),
    })),
  ).toEqual([]);
  await mkdir("artifacts/home-package-journey", { recursive: true });
  await page.screenshot({
    path: `artifacts/home-package-journey/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .locator("footer")
    .getByRole("link", { name: "Fictional preview", exact: true })
    .click();
  await expect(page).toHaveURL(/#demo$/);
  await expect(
    page.getByRole("button", { name: "Solo athlete", exact: true }),
  ).toBeVisible();
});
