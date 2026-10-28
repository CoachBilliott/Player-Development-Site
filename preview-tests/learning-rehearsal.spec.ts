import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TEST_REF, TEST_URL, SAMPLE_TEXT } from "../preview/rehearsal/policy";
const id = "93000000-0000-4000-8000-000000000001";
const own = "93000000-0000-4000-8000-000000000010";
const other = "93000000-0000-4000-8000-000000000011";
const publicKey = "sb_publishable_fixture_only_123456";
async function fixture(context: BrowserContext) {
  let email = "repformed-learning-owner@example.test",
    role = "owner",
    token = "",
    enabled = true,
    identityOk = true;
  const calls: string[] = [];
  let resource: {
    id: string;
    content: { title: string };
    asset_path: string;
    version: number;
    review_stage: string;
  } | null = null;
  const reviews: { decision: string; version: number }[] = [];
  await context.route("**/*.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== TEST_URL) return route.abort();
    calls.push(request.method() + " " + url.pathname);
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers":
        "authorization,apikey,x-client-info,content-type,x-supabase-api-version",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    };
    const respond = (json: unknown, status = 200) =>
      route.fulfill({ status, headers, json });
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/token")) {
      email = request.postDataJSON().email;
      role = email.includes("parent") ? "parent" : "owner";
      const now = Math.floor(Date.now() / 1000);
      token = [
        Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
          "base64url",
        ),
        Buffer.from(
          JSON.stringify({
            sub: id,
            role: "authenticated",
            aud: "authenticated",
            exp: now + 3600,
            email,
          }),
        ).toString("base64url"),
        "fixtureSignature",
      ].join(".");
      return respond({
        access_token: token,
        refresh_token: crypto.randomUUID(),
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        user: { id, email, aud: "authenticated", role: "authenticated" },
      });
    }
    if (url.pathname.endsWith("/user") && !identityOk)
      return respond({ message: "Invalid JWT" }, 401);
    if (url.pathname.endsWith("/user"))
      return respond({
        id,
        email,
        aud: "authenticated",
        role: "authenticated",
      });
    if (url.pathname.endsWith("/logout"))
      return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/current_account_role")) {
      if (request.headers().authorization !== "Bearer " + token)
        return respond({ message: "Invalid JWT" }, 401);
      return respond(role);
    }
    if (url.pathname.endsWith("/learning_quiz_keys"))
      return respond({ code: "42501", message: "Permission denied" }, 403);
    if (url.pathname.endsWith("/staff_training_resources"))
      return respond(resource ? [resource] : []);
    if (url.pathname.endsWith("/learning_catalog"))
      return respond({
        plans: [],
        quizzes: [],
        cohorts: [],
        rules: { friday_time: "17:00:00", low_ready_weeks: 2 },
      });
    if (url.pathname.endsWith("/learning_inbox")) return respond([]);
    if (url.pathname.endsWith("/review_training_resource") && resource) {
      const body = request.postDataJSON();
      reviews.push({
        decision: body.decision,
        version: body.expected_version,
      });
      resource.review_stage =
        body.decision === "submit" ? "pending" : "approved";
      resource.version++;
      return respond(resource);
    }
    if (url.pathname.endsWith("/learning_athlete")) {
      const target = request.postDataJSON().target_profile;
      if (!enabled || (role === "parent" && target !== own))
        return respond(
          { code: "P0001", message: "Athlete is outside your learning scope." },
          400,
        );
      return respond({
        can_submit: true,
        is_guardian: role === "parent",
        enrollments: [],
      });
    }
    if (url.pathname.startsWith("/storage/v1/object/sign/training-media/")) {
      const path = url.pathname.slice("/storage/v1".length);
      if (request.method() === "POST")
        return respond({ signedURL: path + "?token=fixture" });
      return route.fulfill({
        status: 200,
        headers,
        body: SAMPLE_TEXT,
        contentType: "text/plain",
      });
    }
    if (url.pathname.startsWith("/storage/v1/object/training-media/"))
      return respond({
        Key: url.pathname.split("/object/")[1],
        Id: crypto.randomUUID(),
      });
    if (url.pathname.endsWith("/training_resources")) {
      resource = {
        ...request.postDataJSON(),
        version: 1,
        review_stage: "draft",
      };
      return route.fulfill({ status: 201, headers });
    }
    return respond({ message: "Fixture endpoint not connected" }, 403);
  });
  return {
    calls,
    reviews,
    expireIdentity: () => {
      identityOk = false;
    },
    setEnabled: (value: boolean) => {
      enabled = value;
    },
  };
}
async function connect(page: Page) {
  await page.getByLabel("Public test publishable/anon key").fill(publicKey);
  await page
    .getByRole("button", { name: "Load public test configuration" })
    .click();
}
async function login(page: Page, role = "owner") {
  await page
    .getByLabel("Approved test account")
    .selectOption(`repformed-learning-${role}@example.test`);
  // Generated fixture-only text, intercepted locally. Never a hosted credential.
  await page.getByLabel("Temporary test password").fill(crypto.randomUUID());
  await page.getByRole("button", { name: "Sign in to test project" }).click();
  await expect(
    page.getByText("Verified session", { exact: false }),
  ).toBeVisible();
}
test("public-only configuration makes no request before sign-in and confines CSP", async ({
  page,
  context,
}) => {
  const f = await fixture(context);
  const response = await page.goto("./");
  expect(response?.headers()["content-security-policy"]).toContain(
    `connect-src ${TEST_URL};`,
  );
  await page
    .getByLabel("Public test publishable/anon key")
    .fill("sb_secret_not_a_real_key");
  await page
    .getByRole("button", { name: "Load public test configuration" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Rejected configuration",
  );
  expect(f.calls).toEqual([]);
  await connect(page);
  expect(f.calls).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("real-path sign-in flow clears credentials, keeps sessions out of storage and resets on reload", async ({
  page,
  context,
}) => {
  await fixture(context);
  await page.goto("./");
  await connect(page);
  await login(page);
  await expect(page.getByLabel("Temporary test password")).toHaveCount(0);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
  await page
    .getByRole("button", { name: "Check tampered JWT rejection" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "tampered JWT" }),
  ).toContainText("passed");
  await page
    .getByRole("button", { name: "Check anonymous key denial" })
    .click();
  await page
    .getByRole("button", { name: "Check signed-in raw key denial" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "raw keys" }),
  ).toContainText("passed");
  await page.reload();
  await expect(
    page.getByLabel("Public test publishable/anon key"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Actual training bank" }),
  ).toHaveCount(0);
});
test("cross-profile denials require existing-profile and same-session positive controls", async ({
  page,
  context,
}) => {
  const f = await fixture(context);
  await page.goto("./");
  await connect(page);
  await login(page);
  await page.getByLabel("Synthetic profile UUID").fill(other);
  await page
    .getByRole("button", { name: "Check profile access", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("profile allow: passed");
  await page
    .getByRole("button", { name: "Sign out and clear private views" })
    .click();
  await login(page, "parent");
  await page.getByLabel("Synthetic profile UUID").fill(other);
  await page.getByLabel("Expected profile result").selectOption("deny");
  await page
    .getByRole("button", { name: "Check profile access", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("profile deny: blocked");
  await page.getByLabel("Synthetic profile UUID").fill(own);
  await page.getByLabel("Expected profile result").selectOption("allow");
  f.setEnabled(false);
  await page
    .getByRole("button", { name: "Check profile access", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "profile allow: blocked",
  );
  f.setEnabled(true);
  await page
    .getByRole("button", { name: "Check profile access", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("profile allow: passed");
  await page.getByLabel("Synthetic profile UUID").fill(other);
  await page.getByLabel("Expected profile result").selectOption("deny");
  await page
    .getByRole("button", { name: "Check profile access", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("profile deny: passed");
});
test("original sample uses stable private upload and sign/read without exposing URLs in results", async ({
  page,
  context,
}) => {
  const f = await fixture(context);
  await page.goto("./");
  await connect(page);
  await login(page);
  await page
    .getByRole("button", { name: "Upload original synthetic text lesson" })
    .click();
  await expect(page.getByRole("status")).toContainText("sample upload: passed");
  await expect(
    page.getByRole("button", { name: "Upload original synthetic text lesson" }),
  ).toBeDisabled();
  expect(
    f.calls.filter((c) =>
      c.startsWith("POST /storage/v1/object/training-media/"),
    ),
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: "Check private signing and bytes" })
    .click();
  await expect(page.getByRole("status")).toContainText("media allow: passed");
  await expect(page.getByRole("table")).not.toContainText("token=");
  await expect(page.getByRole("table")).not.toContainText(TEST_REF);
  await page
    .getByRole("button", { name: "Actual training bank", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Refresh real test resources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit sample for review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve original test sample", exact: true })
    .click();
  await expect(
    page.getByText("version 3 · approved", { exact: false }),
  ).toBeVisible();
  expect(f.reviews).toEqual([
    { decision: "submit", version: 1 },
    { decision: "approve", version: 2 },
  ]);
  await page
    .getByRole("button", { name: "Boundary checks", exact: true })
    .click();
  f.expireIdentity();
  await page
    .getByRole("button", { name: "Check signed-in raw key denial" })
    .click();
  await expect(page.getByRole("status")).toContainText("raw keys: blocked");
  await page
    .getByRole("button", { name: "Check private signing and bytes" })
    .click();
  await expect(page.getByRole("status")).toContainText("media allow: blocked");
});
