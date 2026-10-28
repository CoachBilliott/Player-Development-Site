import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
async function intake(context: BrowserContext, enabled = true) {
  const data = {
    requests: [] as Array<Record<string, unknown>>,
    saved: new Set<string>(),
    alerts: 0,
    authWrites: 0,
    provider: 0,
    mode: "normal" as "normal" | "lost_response" | "limited" | "unavailable",
    delay: 0,
  };
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        interestIntakeEnabled: enabled,
      },
    }),
  );
  await context.route("https://api.resend.com/**", (r) => {
    data.provider++;
    return r.abort();
  });
  await context.route("https://separate-demo.supabase.co/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    if (r.request().method() === "OPTIONS")
      return r.fulfill({ status: 204, headers });
    if (path !== "/functions/v1/interest-intake") {
      if (path.startsWith("/auth/") && r.request().method() === "POST")
        data.authWrites++;
      return r.fulfill({ json: [], headers });
    }
    const body = r.request().postDataJSON();
    data.requests.push(body);
    if (data.delay)
      await new Promise((resolve) => setTimeout(resolve, data.delay));
    if (data.mode === "limited")
      return r.fulfill({
        status: 429,
        json: { code: "temporarily_limited" },
        headers,
      });
    if (data.mode === "unavailable")
      return r.fulfill({
        status: 503,
        json: { code: "receipt_unconfirmed" },
        headers,
      });
    const key = `${body.email.trim().toLowerCase()}:${body.packageInterest}`;
    if (!data.saved.has(key)) {
      data.saved.add(key);
      data.alerts++;
    }
    if (data.mode === "lost_response") {
      data.mode = "normal";
      return r.abort();
    }
    return r.fulfill({
      status: 202,
      json: { status: "accepted", reference: body.id },
      headers,
    });
  });
  return data;
}
async function fill(page: import("@playwright/test").Page) {
  const form = page.getByRole("form", { name: "Send adult package interest" });
  await form.getByLabel("Adult name").fill("Fictional Adult");
  await form.getByLabel("Adult email").fill("fictional-adult@example.test");
  await form.getByLabel("I’m 18 or older.").check();
  return form;
}
test("short adult interest works by keyboard without account or email-app launch", async ({
  page,
  context,
}, info) => {
  const d = await intake(context);
  await page.goto("./#membership");
  const form = await fill(page);
  await expect(form.getByRole("textbox")).toHaveCount(2);
  await expect(form.getByRole("combobox")).toHaveValue("undecided");
  await expect(
    form.getByLabel("Email me when Repformed launches"),
  ).not.toBeChecked();
  await expect(form).toContainText(
    "Stored privately for Owner/Manager follow-up",
  );
  await expect(
    form.getByRole("link", { name: "Interest privacy" }),
  ).toHaveAttribute("href", /interest-privacy\.html$/);
  await expect(form).toContainText("Repformed@gmail.com");
  await expect(page.locator("#package-interest")).toContainText(
    "Interest only",
  );
  expect(
    (await new AxeBuilder({ page }).include("#package-interest").analyze())
      .violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir("artifacts/interest-intake", { recursive: true });
  await page.locator("#package-interest").screenshot({
    path: `artifacts/interest-intake/form-${info.project.name}.png`,
    style: ".app-header,.app-tabs{visibility:hidden !important}",
  });
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Interest received");
  await expect(page.getByRole("status")).toContainText(
    "saved for staff review",
  );
  expect(d.saved.size).toBe(1);
  expect(d.alerts).toBe(1);
  expect(d.requests).toHaveLength(1);
  expect(d.requests[0].launchUpdates).toBe(false);
  expect(d.requests[0].launchNoticeVersion).toBe("repformed-launch-notice-v1");
  expect(d.authWrites).toBe(0);
  expect(d.provider).toBe(0);
});
test("repeated clicks and a refreshed resubmission produce one saved interest and one alert", async ({
  page,
  context,
}) => {
  const d = await intake(context);
  d.delay = 150;
  await page.goto("./#membership");
  const form = await fill(page);
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .dblclick();
  await expect(page.getByRole("status")).toContainText("Interest received");
  expect(d.requests).toHaveLength(1);
  await page.reload();
  const again = await fill(page);
  await again
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Interest received");
  expect(d.requests).toHaveLength(2);
  expect(d.saved.size).toBe(1);
  expect(d.alerts).toBe(1);
});
test("lost response retains the draft and reuses the exact idempotency reference on retry", async ({
  page,
  context,
}) => {
  const d = await intake(context);
  d.mode = "lost_response";
  await page.goto("./#membership");
  const form = await fill(page);
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "could not confirm receipt",
  );
  await expect(form.getByLabel("Adult email")).toHaveValue(
    "fictional-adult@example.test",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(d.saved.size).toBe(1);
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Interest received");
  expect(d.requests[0].id).toBe(d.requests[1].id);
  expect(d.alerts).toBe(1);
});
test("service/limit failures preserve inputs and leave manual email as an explicit secondary fallback", async ({
  page,
  context,
}) => {
  const d = await intake(context);
  d.mode = "limited";
  await page.goto("./#membership");
  const form = await fill(page);
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "temporarily limiting requests",
  );
  expect(d.saved.size).toBe(0);
  d.mode = "unavailable";
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "could not confirm receipt",
  );
  await expect(form.getByLabel("Adult name")).toHaveValue("Fictional Adult");
  await page.locator(".interest-email-fallback summary").click();
  await expect(
    page.getByRole("link", { name: "Email package interest" }),
  ).toHaveAttribute("href", /^mailto:Repformed@gmail.com/);
  await expect(page.locator(".interest-email-fallback")).toContainText(
    "fallback does not submit the form",
  );
  expect(d.provider).toBe(0);
});
test("optional launch choice survives an uncertain retry and a changed choice receives a fresh reference", async ({
  page,
  context,
}) => {
  const d = await intake(context);
  d.mode = "lost_response";
  await page.goto("./#membership");
  const form = await fill(page);
  await form.getByLabel("Email me when Repformed launches").check();
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "could not confirm receipt",
  );
  await expect(
    form.getByLabel("Email me when Repformed launches"),
  ).toBeChecked();
  d.mode = "lost_response";
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "could not confirm receipt",
  );
  expect(d.requests[1].id).toBe(d.requests[0].id);
  expect(d.requests[1].launchUpdates).toBe(true);
  await form.getByLabel("Email me when Repformed launches").uncheck();
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Interest received");
  expect(d.requests[2].id).not.toBe(d.requests[0].id);
  expect(d.requests[2].launchUpdates).toBe(false);
  expect(d.saved.size).toBe(1);
  expect(d.alerts).toBe(1);
});
test("adult declaration is required and navigating away never shows false success on another page", async ({
  page,
  context,
}) => {
  const d = await intake(context);
  d.delay = 150;
  await page.goto("./#membership");
  const form = await fill(page);
  await form.getByLabel("I’m 18 or older.").uncheck();
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  expect(d.requests).toHaveLength(0);
  await form.getByLabel("I’m 18 or older.").check();
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  await page.goto("./#home");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Know the game",
  );
  await expect(
    page.getByText("Interest received.", { exact: true }),
  ).toHaveCount(0);
});
test("disabled intake retains the existing honest mailto flow and never submits data", async ({
  page,
  context,
}) => {
  const d = await intake(context, false);
  await page.goto("./#membership");
  await expect(
    page.getByRole("form", { name: "Send adult package interest" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Email package interest" }),
  ).toBeVisible();
  await expect(page.locator("#package-interest")).toContainText(
    "opens your email app",
  );
  expect(d.requests).toHaveLength(0);
});
test("interest privacy names the minimal data, staff scope, optional alerts and removal contact", async ({
  page,
  context,
}) => {
  await intake(context);
  await page.goto("./interest-privacy.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your interest. Your information.",
  );
  await expect(page.getByRole("main")).toContainText(
    "authorized Owners and Managers",
  );
  await expect(page.getByRole("main")).toContainText(
    "Submitting interest does not add you to a marketing mailing list",
  );
  await expect(page.getByRole("main")).toContainText("starts unchecked");
  await expect(page.getByRole("main")).toContainText(
    "does not cancel an earlier",
  );
  await expect(page.getByRole("main")).toContainText(
    "If enabled, staff alerts go only",
  );
  await expect(page.getByRole("main")).toContainText(
    "request access, correction or removal",
  );
  for (const a of await page
    .getByRole("link", { name: "Repformed@gmail.com", exact: true })
    .all())
    await expect(a).toHaveAttribute("href", "mailto:Repformed@gmail.com");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
