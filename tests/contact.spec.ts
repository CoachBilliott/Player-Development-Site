import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";

test.beforeEach(async ({ context }) => disableBackend(context));

test("Contact is reachable from the website navigation and footer and survives refresh", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#home");
  await expect(
    page.locator("footer").getByRole("link", { name: "Contact", exact: true }),
  ).toHaveAttribute("href", "#contact");
  if (info.project.name === "phone") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Contact", exact: true })
      .click();
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toHaveCount(0);
  } else {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Contact", exact: true })
      .click();
  }
  await expect(page).toHaveURL(/#contact$/);
  await expect(
    page.getByRole("heading", { name: "Let’s talk training.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Repformed@gmail.com", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/#contact$/);
  await expect(
    page.getByRole("link", { name: "Open email app", exact: true }),
  ).toBeVisible();
});

test("contact email topics prepare a message without claiming to send or storing a request", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("./#contact");
  const topic = page.getByLabel("What is your question about?");
  const button = page.getByRole("link", {
    name: "Open email app",
    exact: true,
  });
  await topic.selectOption("Privacy and account deletion");
  const email = new URL((await button.getAttribute("href"))!);
  expect(email.protocol).toBe("mailto:");
  expect(email.pathname).toBe("Repformed@gmail.com");
  expect(email.searchParams.get("subject")).toBe(
    "Repformed — Privacy and account deletion",
  );
  await topic.selectOption("Video review questions");
  expect(
    new URL((await button.getAttribute("href"))!).searchParams.get("subject"),
  ).toContain("Video review questions");
  await expect(
    page.getByText("This opens your email app", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Message sent", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: /Account & login/ }).click();
  await expect(page).toHaveURL(/#account$/);
  expect(posts).toEqual([]);
});

test("approved FAQ answers can be searched, opened, cleared and followed to account help", async ({
  page,
}) => {
  await page.goto("./#contact");
  const search = page.getByLabel("Search help questions");
  await search.fill("password reset");
  await expect(page.getByRole("status")).toHaveText("1 answer found");
  await page.getByText("How do I sign up or log in?", { exact: true }).click();
  await expect(
    page.getByText("Public registration is not open yet.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open account access", exact: true }),
  ).toBeVisible();
  await search.fill("a question not in these answers xyz");
  await expect(page.getByRole("status")).toHaveText("0 answers found");
  await expect(
    page.getByText("No matching answer yet.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(search).toHaveValue("");
  await page
    .getByText("How do I get help with privacy or account deletion?", {
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("link", {
      name: "Read account and privacy help",
      exact: true,
    }),
  ).toHaveAttribute("href", /account-help\.html$/);
});

test("Contact fits phones and passes automated accessibility checks with expanded answers", async ({
  page,
}) => {
  await page.goto("./#contact");
  await page
    .getByText("How do private video reviews work?", { exact: true })
    .click();
  await expect(
    page.getByText("The target is 48 consecutive hours", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.html),
    })),
  ).toEqual([]);
});

test("app help links to the public Contact page without a separate sign-in", async ({
  page,
}) => {
  await page.goto("./?source=app#app-help");
  await expect(
    page.getByRole("link", { name: "Contact the team", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://coachbilliott.github.io/Player-Development-Site/#contact",
  );
});
