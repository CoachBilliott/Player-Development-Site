import { disableBackend } from "./backendFixture";
import { test, expect } from "@playwright/test";
import { mockProject, sharedSignIn, type Row } from "./contentFixture";

test.beforeEach(async ({ context }) => {
  await disableBackend(context);
});

test("configured shared publishing saves, edits across visitors, and removes a sample resource", async ({
  page,
  context,
  browser,
}) => {
  const rows = new Map<string, Row>();
  await mockProject(context, rows, true, true);
  await sharedSignIn(page);
  await expect(
    page.getByRole("heading", { name: "Coach content studio", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "shared-original.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Original fictional shared practice."),
    });
  await page.getByLabel("Resource title").fill("Shared paper practice");
  await page
    .getByLabel("Step-by-step instructions")
    .fill("Draw a shape.\nPoint to it.\nPause with an adult.");
  await page.getByLabel("Content access").selectOption("public_sample");
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  expect(rows.size).toBe(0);
  await page
    .getByRole("button", { name: "Publish to shared library" })
    .dblclick();
  await expect(
    page.getByText("Published to the shared sample library.", { exact: true }),
  ).toBeVisible();
  expect(rows.size).toBe(1);
  const visitor = await browser.newContext();
  await mockProject(visitor, rows);
  const partner = await visitor.newPage();
  await partner.goto(new URL("./#library", page.url()).href);
  await partner.getByRole("searchbox").fill("Shared paper practice");
  await expect(
    partner.getByRole("button", { name: /Shared paper practice/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Shared paper practice" })
    .click();
  await page.getByLabel("Resource title").fill("Updated shared paper practice");
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await page.getByRole("button", { name: "Save resource changes" }).click();
  await expect(
    page.getByText("Resource changes saved.", { exact: true }),
  ).toBeVisible();
  await partner.reload();
  await partner.getByRole("searchbox").fill("Updated shared paper practice");
  await expect(
    partner.getByRole("button", { name: /Updated shared paper practice/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Updated shared paper practice" })
    .click();
  await page.getByRole("button", { name: "Yes, remove resource" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(rows.size).toBe(0);
  await partner.reload();
  await partner.getByRole("searchbox").fill("Updated shared paper practice");
  await expect(
    partner.getByRole("button", { name: /Updated shared paper practice/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Coach sign-in" }),
  ).toBeVisible();
  await visitor.close();
});

test("signed-in accounts without coach membership never receive publishing controls", async ({
  page,
  context,
}) => {
  await mockProject(context, new Map(), false);
  await sharedSignIn(page);
  await expect(page.getByRole("alert")).toContainText(
    "not approved to publish",
  );
  await expect(
    page.getByRole("button", { name: /Publish to shared library/ }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Choose a video or file", { exact: true }),
  ).toHaveCount(0);
});

test("staff publishing requires sign-in and allows authorized staff to cancel local destination changes", async ({
  page,
  context,
}) => {
  const rows = new Map<string, Row>();
  await mockProject(context, rows);
  await page.goto("./#coach");
  await expect(
    page.getByRole("heading", { name: "Coach sign-in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Choose a video or file", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "This browser", exact: true }),
  ).toHaveCount(0);
  await sharedSignIn(page);
  await page.getByRole("button", { name: "This browser", exact: true }).click();
  await page.getByRole("button", { name: "Switch destination" }).click();
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "practice.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Original fictional sample."),
    });
  await page
    .getByRole("button", { name: "Shared website", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Resource title")).toHaveValue("practice");
  await page
    .getByRole("button", { name: "Shared website", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch destination" }).click();
  await expect(page.getByLabel("Resource title")).toHaveCount(0);
  expect(rows.size).toBe(0);
});

test("protected uploads stay out of public demo pages and disappear immediately after sign-out", async ({
  page,
  context,
  browser,
}) => {
  const rows = new Map<string, Row>();
  await mockProject(context, rows);
  await sharedSignIn(page);
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "protected.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Original illustrative practice. Fictional data only.",
      ),
    });
  await expect(page.getByLabel("Content access")).toHaveValue("member_only");
  await page.getByLabel("Resource title").fill("Protected original practice");
  await page
    .getByLabel("Step-by-step instructions")
    .fill("Point to a shape.\nPause with a practice partner.");
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await expect(
    page.getByText(
      "Destination: protected training library · staff review only",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Publish to shared library" })
    .dblclick();
  await expect(
    page.getByText("Saved to the protected training library.", { exact: true }),
  ).toBeVisible();
  expect([...rows.values()][0].visibility).toBe("member_only");
  await page.goto("./#member-library");
  await expect(
    page.getByRole("button", { name: "Preview Protected original practice" }),
  ).toBeVisible();
  await page.goto("./#library");
  await page.getByRole("searchbox").fill("Protected original practice");
  await expect(
    page.getByRole("button", { name: /Protected original practice/ }),
  ).toHaveCount(0);
  const visitor = await browser.newContext();
  await mockProject(visitor, rows);
  const partner = await visitor.newPage();
  await partner.goto(new URL("./#library", page.url()).href);
  await partner.getByRole("searchbox").fill("Protected original practice");
  await expect(
    partner.getByRole("button", { name: /Protected original practice/ }),
  ).toHaveCount(0);
  await visitor.close();
  await page.goto("./#coach");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("./#member-library");
  await expect(
    page.getByRole("heading", { name: "Sign in to open your workspace." }),
  ).toBeVisible();
  await expect(
    page.getByText("Protected original practice", { exact: true }),
  ).toHaveCount(0);
});
