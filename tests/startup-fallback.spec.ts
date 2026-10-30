import { test, expect } from "@playwright/test";
import { disableBackend } from "./backendFixture";

test("blocked main entry retains useful contact and retry without claiming submission", async ({
  page,
  context,
}) => {
  await disableBackend(context);
  // Vite dev and production entries: fail only the main application module.
  await context.route(
    /\/(?:src\/main\.tsx|assets\/index-[^/]+\.js)(?:\?.*)?$/,
    (route) => route.abort(),
  );
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Repformed");
  await expect(
    page.getByRole("link", { name: "reload the website" }),
  ).toHaveAttribute("href", "./");
  await expect(
    page.getByRole("link", { name: "email Repformed@gmail.com" }),
  ).toHaveAttribute("href", "mailto:Repformed@gmail.com");
  await expect(page.getByRole("main")).toContainText(
    "does not send a message or submit interest",
  );
});

test("JavaScript-disabled visitors receive an honest contact alternative", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.getByRole("main")).toContainText("JavaScript is needed");
  await expect(
    page.getByRole("link", { name: "email Repformed@gmail.com" }),
  ).toBeVisible();
  await context.close();
});

test("successful startup replaces fallback with the actual page", async ({
  page,
  context,
}) => {
  await disableBackend(context);
  await page.goto("./#home");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Know the game",
  );
  await expect(
    page.getByRole("main", { name: "Repformed website loading" }),
  ).toHaveCount(0);
});
