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
        name: role === "coach" ? "Your athletes." : "Athletes.",
      }),
    ).toBeVisible();
    await expect(nav.getByRole("link")).toHaveText([
      "Athletes",
      "Training",
      "Staff & settings",
    ]);
    await expect(
      page
        .getByRole("navigation", { name: "Workspace tools" })
        .getByRole("link", { name: "Interest", exact: true }),
    ).toHaveCount(role === "coach" ? 0 : 1);
    await page
      .getByRole("link", { name: "Account settings", exact: true })
      .click();
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
  await page
    .getByRole("link", { name: "Staff & settings", exact: true })
    .click();
  await expect(
    page.getByLabel("Account level for fictional-owner@example.test"),
  ).toBeDisabled();
  const row = page.locator(".access-person").filter({
    has: page.getByText("fictional-manager@example.test", { exact: true }),
  });
  await row.locator("summary").click();
  await row.getByRole("combobox").selectOption("coach");
  await row.getByRole("button", { name: "Review access change" }).click();
  await page.getByRole("button", { name: "Confirm account level" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not confirmed",
  );
  await page.getByRole("button", { name: "Keep current level" }).click();
  await page.reload();
  await page.getByLabel("Preview role").selectOption("owner");
  await page
    .getByRole("link", { name: "Staff & settings", exact: true })
    .click();
  await expect(
    page.getByLabel("Account level for fictional-manager@example.test"),
  ).toHaveValue("manager");
});

test("three staff journeys show real components but reject fictional assignment writes", async ({
  page,
}, info) => {
  await page.goto("./#account");
  await page.getByLabel("Preview role").selectOption("owner");
  await mkdir("artifacts/staff-workflows", { recursive: true });
  await page.screenshot({
    path: `artifacts/staff-workflows/preview-athletes-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your training bank." }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/staff-workflows/preview-training-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Athletes", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Fictional Jordan/ })
    .first()
    .click();
  const athlete = page.getByRole("dialog");
  await athlete
    .getByRole("button", { name: "Assign training", exact: true })
    .click();
  await athlete
    .getByRole("button", { name: /Ready position & controlled steps/ })
    .click();
  await expect(page.getByLabel("Assign to customer account")).toHaveCount(0);
  await expect(page.getByLabel("Assign to athlete")).toHaveCount(0);
  await athlete
    .getByRole("button", { name: "Preview assignment", exact: true })
    .click();
  const confirm = athlete.getByRole("region", {
    name: "Assign this complete workout?",
  });
  await expect(confirm).toContainText(
    "This replaces only this athlete's current saved workout.",
  );
  const keepCurrent = confirm.getByRole("button", {
    name: "Keep current assignment",
    exact: true,
  });
  await keepCurrent.scrollIntoViewIfNeeded();
  expect(
    await keepCurrent.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return (
        document
          .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          ?.closest("button") === button
      );
    }),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/staff-workflows/preview-confirm-${info.project.name}.png`,
    fullPage: true,
  });
  await confirm
    .getByRole("button", { name: "Confirm workout assignment", exact: true })
    .click();
  await expect(confirm.getByRole("alert")).toContainText("not confirmed");
  await confirm
    .getByRole("button", { name: "Keep current assignment", exact: true })
    .click();
  await athlete
    .getByRole("button", { name: "Cancel assignment", exact: true })
    .click();
  await athlete
    .getByRole("button", { name: "Back to athletes", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Staff & settings", exact: true })
    .click();
  await page.screenshot({
    path: `artifacts/staff-workflows/preview-staff-${info.project.name}.png`,
    fullPage: true,
  });
  for (const width of [320, 375, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
