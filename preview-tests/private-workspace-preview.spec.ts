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

test("Google Sheets upload validates before saving a quiz version", async ({
  page,
}, info) => {
  await page.goto("./#weekly-demo");
  await expect(
    page.getByRole("heading", { name: "Weekly learning walkthrough" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Training bank", exact: true })
    .click();
  await page.getByRole("button", { name: "Quiz uploads", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Blank template" }),
  ).toHaveAttribute("download", "");
  await page
    .getByLabel("Quiz title", { exact: true })
    .fill("Fictional imported quiz");
  await page.getByLabel("CSV file").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("wrong,headers\ninvalid,file"),
  });
  await expect(page.getByRole("alert")).toContainText("Nothing was published");
  await expect(
    page.getByRole("button", { name: "Save quiz version" }),
  ).toHaveCount(0);
  await page
    .getByLabel("CSV file")
    .setInputFiles("public/templates/repformed-quiz-example.csv");
  await expect(
    page.getByText(
      "3 questions · 4 points. Verify the answer key before saving.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save quiz version" }).click();
  await expect(page.getByRole("status")).toContainText("Quiz version saved");
  await expect(
    page.getByText("Fictional imported quiz · version 1 · 4 points"),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/private-workspace/learning-upload-${info.project.name}.png`,
    fullPage: true,
  });
});
test("household saves quiz draft, submits inside site, coach grades, and history survives Sunday", async ({
  page,
}, info) => {
  await page.goto("./#weekly-demo");
  await page.getByLabel("Sample role").selectOption("parent");
  await page.getByRole("button", { name: "Open week", exact: true }).click();
  await page.getByRole("button", { name: "Take quiz", exact: true }).click();
  await page.getByLabel("START", { exact: true }).check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.getByRole("button", { name: "Back to this week" }).click();
  await page
    .getByRole("button", { name: "Continue quiz", exact: true })
    .click();
  await expect(page.getByLabel("START", { exact: true })).toBeChecked();
  await page.getByLabel("True", { exact: true }).check();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("Fictional sample response");
  await page
    .getByRole("button", { name: "Submit answers", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "awaiting staff grading",
  );
  await page.getByRole("button", { name: "Back to this week" }).click();
  await page.getByLabel("Sample role").selectOption("coach");
  await page.getByRole("button", { name: "Athlete plan", exact: true }).click();
  await page.getByRole("button", { name: "Open week", exact: true }).click();
  await page
    .getByText("Submitted · awaiting written grade", { exact: false })
    .click();
  await page
    .getByRole("button", { name: "Grade written answers", exact: true })
    .click();
  await page
    .getByLabel("Describe the sample marker in one sentence. · points / 2")
    .fill("1.5");
  await page
    .getByLabel("Feedback", { exact: true })
    .fill("Fictional graded response");
  await page.getByRole("button", { name: "Save grade revision" }).click();
  await expect(page.getByText("Score 3.5 / 4", { exact: false })).toBeVisible();
  await page.getByLabel("Sample role").selectOption("parent");
  await page
    .getByRole("button", { name: "Simulate next Sunday release" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sample learning week 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sample learning week 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open week", exact: true })
    .nth(1)
    .click();
  await expect(page.getByText("Score 3.5 / 4", { exact: false })).toBeVisible();
  await page.screenshot({
    path: `artifacts/private-workspace/learning-history-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("Sample role").selectOption("other_coach");
  await page.getByRole("button", { name: "Athlete plan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "outside this fictional role",
  );
});
test("Friday notices and reset work without external requests or phone overflow", async ({
  page,
}, info) => {
  const foreign: string[] = [];
  await page.route("**/*", (r) => {
    if (new URL(r.request().url()).hostname !== "127.0.0.1") {
      foreign.push(r.request().url());
      return r.abort();
    }
    return r.continue();
  });
  await page.goto("./#weekly-demo");
  await page.getByLabel("Sample role").selectOption("parent");
  await page.getByRole("button", { name: "Simulate Friday reminder" }).click();
  await expect(
    page.getByText("There is unfinished work in this week’s plan."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(page.getByText("Unread ·")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset samples" }).click();
  await expect(page.getByText("No active plan notices.")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(foreign).toEqual([]);
  await page.screenshot({
    path: `artifacts/private-workspace/learning-athlete-${info.project.name}.png`,
    fullPage: true,
  });
});

test("weekly roster uses current plans, real paging controls and actionable athlete alerts", async ({
  page,
}, info) => {
  await page.goto("./#weekly-demo");
  const roster = page
    .getByRole("region", { name: "Client service dashboard" })
    .or(page.locator('section[aria-label="Client service dashboard"]'));
  await roster
    .getByRole("searchbox", { name: "Search athletes or clients" })
    .fill("Avery");
  await expect(
    roster.getByText("Fictional two-week pathway", { exact: true }),
  ).toBeVisible();
  await expect(
    roster.getByText("No training assigned", { exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `artifacts/private-workspace/learning-roster-${info.project.name}.png`,
    fullPage: true,
  });
  await roster
    .getByRole("button", { name: "View weekly plan for Fictional Avery" })
    .click();
  const detail = page.getByRole("dialog");
  await expect(
    detail.getByRole("heading", { name: "Weekly plan", exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Assign training", exact: true }),
  ).toHaveCount(0);
  await detail.getByRole("button", { name: "Pause plan", exact: true }).click();
  await detail
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(
    detail.getByRole("heading", { name: "Review paused plan", exact: true }),
  ).toBeVisible();
  await detail
    .getByRole("button", { name: "Back to athletes", exact: true })
    .click();
  await roster
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    roster.getByRole("button", { name: "Next page", exact: true }),
  ).toBeEnabled();
  await roster.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(
    roster.getByRole("navigation", { name: "Athlete roster pages" }),
  ).toContainText("Page 2");
  await roster
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Training bank", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open Fictional Jordan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Weekly plan", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/private-workspace/learning-alert-drilldown-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("Sample role").selectOption("coach");
  await expect(page.locator(".staff-service-table")).toContainText(
    "Fictional Avery",
  );
  await expect(page.locator(".staff-service-table")).not.toContainText(
    "Fictional Jordan",
  );
});
test("Google Sheets re-import creates version two while a released quiz keeps version one", async ({
  page,
}) => {
  await page.goto("./#weekly-demo");
  await page
    .getByRole("button", { name: "Training bank", exact: true })
    .click();
  await page.getByRole("button", { name: "Quiz uploads", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Save as", exact: true })
    .selectOption({ label: "New version of Fictional format quiz · latest 1" });
  await expect(page.getByLabel("Quiz title", { exact: true })).toBeDisabled();
  const csv = (
    await readFile("public/templates/repformed-quiz-example.csv", "utf8")
  ).replace(
    "Which marker says START?",
    "Version two: which marker says START?",
  );
  await page.getByLabel("CSV file").setInputFiles({
    name: "version-two.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Save quiz version", exact: true })
    .click();
  await expect(
    page.getByText("Fictional format quiz · version 2 · 4 points", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Sample role").selectOption("parent");
  await page.getByRole("button", { name: "Open week", exact: true }).click();
  await page.getByRole("button", { name: "Take quiz", exact: true }).click();
  await expect(
    page.getByText("1. Which marker says START?", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Version two: which marker says START?", { exact: false }),
  ).toHaveCount(0);
});
test("groups retain selections across pages and enroll only new members", async ({
  page,
}, info) => {
  await page.goto("./#weekly-demo");
  await page
    .getByRole("button", { name: "Training bank", exact: true })
    .click();
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await page.getByText("Create or edit a group", { exact: true }).click();
  await page
    .getByLabel("Group name", { exact: true })
    .fill("Fictional growing group");
  const picker = page.locator(".learning-roster-picker");
  await picker
    .getByRole("searchbox", { name: "Find athletes", exact: true })
    .fill("Avery");
  await picker
    .getByRole("checkbox", { name: "Fictional Avery", exact: true })
    .check();
  await picker
    .getByRole("searchbox", { name: "Find athletes", exact: true })
    .fill("");
  await expect(
    picker.getByRole("button", { name: "Next athletes" }),
  ).toBeEnabled();
  await picker.getByRole("button", { name: "Next athletes" }).click();
  await expect(
    picker.getByRole("navigation", { name: "Group athlete pages" }),
  ).toContainText("Page 2");
  await picker
    .getByRole("checkbox", { name: "Fictional Athlete 026", exact: true })
    .check();
  await expect(
    picker.getByText("2 selected across all pages · maximum 500"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Group", exact: true })
    .selectOption({ label: "Fictional growing group · 2 athletes" });
  await page
    .getByRole("combobox", { name: "Plan", exact: true })
    .selectOption({ label: "Fictional two-week pathway" });
  await page
    .getByRole("button", { name: "Review group enrollment", exact: true })
    .click();
  const confirm = page
    .getByRole("region", { name: "Confirm group enrollment" })
    .or(page.locator('section[aria-label="Confirm group enrollment"]'));
  await expect(confirm).toContainText(
    "1 new enrollments · 1 existing matching plans kept · 0 need attention",
  );
  await confirm
    .getByRole("button", { name: "Confirm group enrollment", exact: true })
    .click();
  await expect(
    page.getByText(
      "Group enrollment saved. Existing matching plans and histories were kept.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/private-workspace/learning-group-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByLabel("Sample athlete")
    .selectOption({ label: "Fictional Avery" });
  await expect(page.getByText("Next release:", { exact: false })).toContainText(
    "Week 2",
  );
});
test("weekly guide has usable chapters, downloadable templates, contact and all five socials", async ({
  page,
}) => {
  const response = await page.goto("./weekly-learning-help.html");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your week. Your library. Your progress.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "blank CSV template", exact: true }),
  ).toHaveAttribute("download", "");
  await expect(
    page.getByRole("link", { name: "Repformed@gmail.com", exact: true }),
  ).toHaveAttribute("href", "mailto:Repformed@gmail.com");
  await expect(
    page
      .getByRole("navigation", { name: "Official social accounts" })
      .getByRole("link"),
  ).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
