import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { mockProject } from "./contentFixture";
import { staffFixture, staffState, coachA } from "./staffServiceFixture";
import { fixture, state, staffId } from "./workoutFixture";

test("one login surface supports recovery, verification and password visibility without a second coach form", async ({
  page,
  context,
}, info) => {
  await mockProject(context, new Map());
  await page.goto("./#coach");
  await expect(
    page.getByRole("heading", { name: "Log in to open the content studio." }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Log in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back." }),
  ).toBeVisible();
  await page.getByLabel("Account email").fill("fictional-adult@example.test");
  await page.getByLabel("Password", { exact: true }).fill("ExamplePass1!");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Reset your password." }),
  ).toBeFocused();
  await expect(page.getByLabel("Account email")).toHaveValue(
    "fictional-adult@example.test",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back." }),
  ).toBeFocused();
  await page.goForward();
  await expect(
    page.getByRole("heading", { level: 1, name: "Reset your password." }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Verify your email." }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await mkdir("artifacts/private-workspace", { recursive: true });
  await page.screenshot({
    path: `artifacts/private-workspace/login-${info.project.name}.png`,
    fullPage: true,
  });
});

for (const role of ["owner", "manager", "coach"] as const) {
  test(`${role} workspace navigation keeps daily tools and personal settings distinct`, async ({
    page,
    context,
  }, info) => {
    await staffFixture(
      context,
      staffState(),
      role,
      role === "coach" ? coachA : staffId,
    );
    await page.goto("./#workspace");
    const nav = page.getByRole("navigation", { name: "Workspace navigation" });
    await expect(
      nav.getByRole("link", { name: "Client service", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: role === "coach" ? "Your athletes." : "Client service.",
      }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Team & access", exact: true }),
    ).toHaveCount(role === "owner" ? 1 : 0);
    await nav.getByRole("link", { name: "Account", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Account settings." }),
    ).toBeVisible();
    await expect(page.getByLabel("Find an account by email")).toHaveCount(0);
    await expect(page.getByLabel("Adult invitation email")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Change password", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Who is the training for?" }),
    ).toHaveCount(0);
    await mkdir("artifacts/private-workspace", { recursive: true });
    await page.screenshot({
      path: `artifacts/private-workspace/${role}-account-${info.project.name}.png`,
      fullPage: true,
    });
    if (role !== "owner") {
      await page.goto("./#access");
      await expect(
        page.getByRole("heading", { name: "Owner access is required." }),
      ).toBeVisible();
      await expect(page.getByLabel("Find an account by email")).toHaveCount(0);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("Owner access directory is absent in settings and protected self access stays disabled", async ({
  page,
  context,
}, info) => {
  await staffFixture(context, staffState());
  let reads = 0;
  await context.route("**/rest/v1/rpc/list_account_access", (r) => {
    reads++;
    return r.fulfill({
      json: [
        {
          user_id: staffId,
          email: "fictional-staff@example.test",
          role: "owner",
          version: 1,
          email_verified: true,
          adult_setup: true,
        },
      ],
    });
  });
  await page.goto("./#account");
  await expect(
    page.getByRole("heading", { level: 1, name: "Account settings." }),
  ).toBeVisible();
  expect(reads).toBe(0);
  await page
    .getByRole("link", { name: "Manage team access", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Team & access." }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Account level for fictional-staff@example.test"),
  ).toBeDisabled();
  // React StrictMode may repeat read effects; personal settings must not read it.
  expect(reads).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Accounts & roles", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `artifacts/private-workspace/owner-access-${info.project.name}.png`,
    fullPage: true,
  });
});
test("parent training, family profiles and credentials have separate screens with canceled edits", async ({
  page,
  context,
}, info) => {
  await fixture(context, state(), "parent");
  await page.goto("./#workspace");
  await expect(
    page.getByRole("heading", { level: 1, name: "Today’s training." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Delete Fictional/ }),
  ).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  await nav.getByRole("link", { name: "Family profiles", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Your family profiles." }),
  ).toBeVisible();
  const edit = page.getByRole("button", { name: /^Edit Fictional/ }).first();
  await edit.click();
  await expect(page.getByLabel("Player nickname")).toBeVisible();
  await page.getByLabel("Player nickname").fill("Discarded fictional edit");
  await page
    .getByRole("button", { name: "Cancel changes", exact: true })
    .click();
  await expect(
    page.getByText("Discarded fictional edit", { exact: true }),
  ).toHaveCount(0);
  const training = page
    .getByRole("button", { name: "Workouts & permissions", exact: true })
    .first();
  await training.click();
  const detail = page.getByRole("region", {
    name: "Athlete training and permissions",
  });
  await expect(detail).toBeFocused();
  await page.goBack();
  await expect(detail).toHaveCount(0);
  await expect(training).toBeFocused();
  await nav.getByRole("link", { name: "Account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Account settings.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Edit Fictional/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Manage athletes & permissions/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/private-workspace/parent-account-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Your family profiles." }),
  ).toBeVisible();
});
test("public homepage retains its existing header, hero and footer", async ({
  page,
  context,
}, info) => {
  await staffFixture(context, staffState());
  await page.goto("./#home");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Know the game.Own your rep.",
  );
  await expect(page.locator(".private-header")).toHaveCount(0);
  await expect(page.locator(".website-footer")).toBeVisible();
  if (info.project.name === "phone") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
  } else
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
});
