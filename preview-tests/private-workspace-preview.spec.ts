import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
test("fictional role views use actual components and cannot reach a production backend", async ({
  page,
}, info) => {
  const foreign: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (r) => {
    if (new URL(r.request().url()).hostname !== "127.0.0.1") {
      foreign.push(r.request().url());
      return r.abort();
    }
    return r.continue();
  });
  const response = await page.goto("./#account");
  expect(response?.headers()["content-security-policy"]).toContain(
    "connect-src 'none'",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back." }),
  ).toBeVisible();
  await mkdir("artifacts/private-workspace", { recursive: true });
  await page.screenshot({
    path: `artifacts/private-workspace/final-login-${info.project.name}.png`,
    fullPage: true,
  });
  const selector = page.getByLabel("Preview role");
  for (const role of ["owner", "manager", "coach"]) {
    await selector.selectOption(role);
    const nav = page.getByRole("navigation", { name: "Workspace navigation" });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: role === "coach" ? "Your athletes." : "Client service.",
      }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Team & access", exact: true }),
    ).toHaveCount(role === "owner" ? 1 : 0);
    await expect(
      nav.getByRole("link", { name: "Interest", exact: true }),
    ).toHaveCount(role === "coach" ? 0 : 1);
    await nav.getByRole("link", { name: "Account", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Account settings.", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Find an account by email")).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/private-workspace/final-${role}-account-${info.project.name}.png`,
      fullPage: true,
    });
  }
  for (const role of ["parent", "athlete"]) {
    await selector.selectOption(role);
    await expect(
      page.getByRole("heading", { level: 1, name: "Today’s training." }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link", {
        name: role === "parent" ? "Family profiles" : "Profile",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fictional Avery", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/private-workspace/final-${role}-profiles-${info.project.name}.png`,
      fullPage: true,
    });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const headers = await readFile("dist-private-preview/_headers", "utf8");
  expect(headers).toContain("connect-src 'none'");
});
test("preview account changes fail honestly and keep stored fictional roles unchanged", async ({
  page,
}) => {
  await page.goto("./#account");
  await page.getByLabel("Account email").fill("fictional-adult@example.test");
  await page.getByLabel("Password", { exact: true }).fill("FictionalPass1!");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.getByRole("alert")).toContainText("Sign-in failed");
  await expect(page.getByLabel("Preview role")).toHaveValue("visitor");
  await page.getByLabel("Preview role").selectOption("owner");
  await page.getByRole("link", { name: "Team & access", exact: true }).click();
  await expect(
    page.getByLabel("Account level for fictional-owner@example.test"),
  ).toBeDisabled();
  const row = page.locator(".access-person").filter({
    has: page.getByText("fictional-manager@example.test", { exact: true }),
  });
  await row.getByRole("combobox").selectOption("coach");
  await row.getByRole("button", { name: "Review access change" }).click();
  await page.getByRole("button", { name: "Confirm account level" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not confirmed",
  );
  await page.getByRole("button", { name: "Keep current level" }).click();
  await page.reload();
  await page.getByLabel("Preview role").selectOption("owner");
  await page.getByRole("link", { name: "Team & access", exact: true }).click();
  await expect(
    page.getByLabel("Account level for fictional-manager@example.test"),
  ).toHaveValue("manager");
});
