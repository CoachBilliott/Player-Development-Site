import { disableBackend } from "./backendFixture";
import { test, expect } from "@playwright/test";
import { mockProject, sharedSignIn, type Row } from "./contentFixture";

test.beforeEach(async ({ context }) => {
  await disableBackend(context);
});
async function approveSample(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page.goto("./#content-review");
  const item = page
    .locator(".approval-list > li")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await item.getByRole("button", { name: "Preview & review" }).click();
  await page
    .getByRole("button", { name: "Send for review", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm send for review" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await item.getByRole("button", { name: "Preview & review" }).click();
  await page
    .getByRole("button", { name: "Approve & publish", exact: true })
    .click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm approval & publish" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("./#coach");
}

test("configured shared publishing saves, edits across visitors, and removes a sample resource", async ({
  page,
  context,
  browser,
}) => {
  const rows = new Map<string, Row>();
  await mockProject(context, rows, true, true, undefined, "owner");
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
  await page.getByRole("button", { name: "Save shared draft" }).dblclick();
  await expect(
    page.getByText("Sample draft saved. It stays private until approved.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(rows.size).toBe(1);
  expect([...rows.values()][0].status).toBe("draft");
  await approveSample(page, "Shared paper practice");
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
  await page.getByRole("button", { name: "Save changes for review" }).click();
  await expect(
    page.getByText("Changes saved as a draft. Send it for review again.", {
      exact: true,
    }),
  ).toBeVisible();
  await approveSample(page, "Updated shared paper practice");
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
    page.getByRole("heading", { name: "Log in to open the content studio." }),
  ).toBeVisible();
  await visitor.close();
});

test("signed-in accounts without coach membership never receive publishing controls", async ({
  page,
  context,
}) => {
  await mockProject(context, new Map(), false);
  await sharedSignIn(page);
  await expect(
    page.getByRole("heading", { name: "Staff content access required." }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Save shared draft/ }),
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
    page.getByRole("heading", {
      name: "Log in to open the content studio.",
      exact: true,
    }),
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
  await page.getByRole("button", { name: "Save shared draft" }).dblclick();
  await expect(
    page.getByText(
      "Shared draft saved. Send it for review before assigning it.",
      { exact: true },
    ),
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
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Protected original practice", { exact: true }),
  ).toHaveCount(0);
});
