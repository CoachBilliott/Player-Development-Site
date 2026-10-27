import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";

test.beforeEach(async ({ context }) => disableBackend(context));

test("quick help answers approved questions and closes without storing a conversation", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("./#home");
  const launcher = page
    .locator("footer")
    .getByRole("button", { name: "Quick help" });
  await launcher.click();
  const dialog = page.getByRole("dialog", { name: "How can we help?" });
  await expect(
    dialog.getByText("This is FAQ help, not live chat or AI.", {
      exact: false,
    }),
  ).toBeVisible();
  await dialog.getByLabel("Search help topics").fill("password reset");
  await expect(dialog.getByRole("status")).toHaveText("1 answer available");
  await dialog
    .getByRole("button", { name: "How do I sign up or log in?" })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "How do I sign up or log in?" }),
  ).toBeFocused();
  await expect(
    dialog.getByText("Public registration is not open yet.", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "All questions" }).click();
  await expect(dialog.getByLabel("Search help topics")).toHaveValue(
    "password reset",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(dialog.getByLabel("Search help topics")).toHaveValue("");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  expect(posts).toEqual([]);
});

test("unanswered questions hand off to the real inbox without claiming delivery", async ({
  page,
}) => {
  await page.goto("./#contact");
  await page
    .locator("main")
    .getByRole("button", { name: "Quick help" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search help topics").fill("my personal invoice xyz");
  await expect(dialog.getByRole("status")).toHaveText("0 answers available");
  await expect(
    dialog.getByText("We do not have an approved answer", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Email the team" }),
  ).toHaveAttribute("href", /^mailto:Repformed@gmail.com\?subject=/);
  await dialog.getByRole("button", { name: "Show all questions" }).click();
  await expect(dialog.getByRole("status")).toHaveText("9 answers available");
  await dialog
    .getByRole("button", { name: "How do I sign up or log in?" })
    .click();
  await dialog.getByRole("link", { name: "Open account access" }).click();
  await expect(page).toHaveURL(/#account$/);
  await expect(dialog).toHaveCount(0);
});

test("quick help remains readable, keyboard accessible and usable in app help", async ({
  page,
}) => {
  await page.goto("./?source=app#app-help");
  await page.getByRole("button", { name: "Quick help" }).click();
  const dialog = page.getByRole("dialog");
  const results = await new AxeBuilder({ page })
    .include("dialog")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Can I buy a membership or a drill review?" })
    .click();
  await expect(
    dialog.getByText(
      "Checkout, subscriptions and paid review purchases are not active yet.",
      { exact: false },
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("unconfigured socials stay unpublished", async ({ page }) => {
  await page.route("**/social-links.json", (route) =>
    route.fulfill({ json: { links: [] } }),
  );
  await page.goto("./#contact");
  await expect(
    page.getByRole("navigation", { name: "Official social accounts" }),
  ).toHaveCount(0);
});

test("shared social configuration reaches website, app help and guides with safe external links", async ({
  page,
}) => {
  // Fictional fixture only; never written to the published social configuration.
  await page.route("**/social-links.json", (route) =>
    route.fulfill({
      json: {
        links: [
          {
            platform: "Instagram",
            url: "https://www.instagram.com/fictional_test/",
          },
          { platform: "X", url: "https://x.com.evil.example/brand" },
        ],
      },
    }),
  );
  for (const path of [
    "./#contact",
    "./?source=app#app-help",
    "./account-help.html",
    "./phone-test.html",
    "./partner-guide.html",
  ]) {
    await page.goto(path);
    const nav = page
      .getByRole("navigation", { name: "Official social accounts" })
      .first();
    const link = nav.getByRole("link", {
      name: "Instagram (opens outside Player Development)",
    });
    await expect(link).toHaveAttribute(
      "href",
      "https://www.instagram.com/fictional_test/",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(nav.getByRole("link")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
