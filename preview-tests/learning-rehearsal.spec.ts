import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { TEST_REF, TEST_URL, SAMPLE_TEXT } from "../preview/rehearsal/policy";
import { profiles, coachIds } from "../preview/rehearsal/rosterProbe";
const id = "93000000-0000-4000-8000-000000000001";
const own = "93000000-0000-4000-8000-000000000010";
const other = "93000000-0000-4000-8000-000000000011";
const publicKey = "sb_publishable_fixture_only_123456";
async function fixture(context: BrowserContext, roster = false) {
  let actorId = id,
    rosterFailure = "";
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
      if (roster) {
        const account = email.split("repformed-learning-")[1].split("@")[0];
        actorId = (
          {
            owner: "17054a51-d756-4b9e-8048-c82973fe0c55",
            manager: "134e7d0b-e54d-488b-8848-8254db86757c",
            coach: coachIds[0],
            "other-coach": coachIds[1],
            parent: "dc6804e6-fc2f-4bb0-a7ca-de8514e09024",
            "other-parent": "2a566ee0-dd1f-4244-a16f-2c086bc1c6a2",
          } as Record<string, string>
        )[account];
        role = account.includes("parent")
          ? "parent"
          : account.includes("coach")
            ? "coach"
            : account;
      }
      const now = Math.floor(Date.now() / 1000);
      token = [
        Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
          "base64url",
        ),
        Buffer.from(
          JSON.stringify({
            sub: actorId,
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
        user: {
          id: actorId,
          email,
          aud: "authenticated",
          role: "authenticated",
        },
      });
    }
    if (url.pathname.endsWith("/user") && !identityOk)
      return respond({ message: "Invalid JWT" }, 401);
    if (url.pathname.endsWith("/user"))
      return respond({
        id: actorId,
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
    if (
      url.pathname.endsWith("/staff_client_service_roster_page") ||
      url.pathname.endsWith("/staff_athlete_service")
    ) {
      if (request.headers().authorization !== "Bearer " + token)
        return respond({ code: "42501", message: "permission denied" }, 403);
      if (
        rosterFailure === "missing" &&
        !url.pathname.endsWith("/staff_athlete_service")
      )
        return respond({ code: "PGRST202", message: "missing function" }, 404);
      if (rosterFailure === "network") return route.abort();
      const detail = url.pathname.endsWith("/staff_athlete_service");
      const allowed: readonly string[] =
        role === "parent"
          ? []
          : role !== "coach"
            ? profiles
            : actorId === coachIds[0]
              ? [profiles[0]]
              : profiles.slice(1);
      const denied = () =>
        respond(
          {
            code: "P0001",
            message: detail
              ? "This athlete is outside your service roster."
              : "Staff access is required.",
          },
          400,
        );
      const body = request.postDataJSON();
      if (detail)
        return allowed.includes(body.target_profile)
          ? respond({ athlete_id: body.target_profile })
          : denied();
      if (role === "parent") return denied();
      if (rosterFailure === "malformed") return respond({ rows: [] });
      const base = rosterFailure === "leak" ? profiles : allowed;
      let found = [...base];
      const rowFor = (profile: string) => {
        const n = profiles.indexOf(profile as (typeof profiles)[number]);
        const clientId =
          n === 2
            ? "2a566ee0-dd1f-4244-a16f-2c086bc1c6a2"
            : "dc6804e6-fc2f-4bb0-a7ca-de8514e09024";
        return {
          athlete_id: profile,
          client_id: clientId,
          athlete_name: [
            "Fictional Avery",
            "Fictional Jordan",
            "Fictional Other",
          ][n],
          client_label:
            role === "coach"
              ? `Client ${clientId.slice(0, 8)}`
              : n === 2
                ? "repformed-learning-other-parent@example.test"
                : "repformed-learning-parent@example.test",
          position: "Quarterback",
          coach_label:
            n === 0
              ? "repformed-learning-coach@example.test"
              : "repformed-learning-other-coach@example.test",
          workout_title: "",
        };
      };
      if (body.search_text)
        found = found.filter((profile) => {
          const row = rowFor(profile),
            hiddenEmail =
              profile === profiles[2]
                ? "repformed-learning-other-parent@example.test"
                : "repformed-learning-parent@example.test";
          const text =
            rosterFailure === "nickname-search"
              ? row.athlete_name
              : [
                  row.athlete_name,
                  row.client_label,
                  row.position,
                  row.coach_label,
                  row.workout_title,
                  rosterFailure === "hidden-search" ? hiddenEmail : "",
                ].join(" ");
          const normalized = text
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
          return body.search_text
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
            .every((word: string) => normalized.includes(word));
        });
      if (body.coach_filter)
        found = found.filter(
          (p) =>
            (p === profiles[0] ? coachIds[0] : coachIds[1]) ===
            body.coach_filter,
        );
      if (body.status_filter === "unassigned") found = [];
      const size = body.page_size,
        pages = Math.max(1, Math.ceil(found.length / size)),
        number = Math.min(body.page_number, pages);
      return respond({
        source: "account_backend",
        scope: role === "coach" ? "assigned_athletes" : "all_repformed_clients",
        rows: found.slice((number - 1) * size, number * size).map(rowFor),
        coaches: [],
        page: {
          number,
          size,
          pages,
          total: base.length,
          matched: found.length,
          athletes: base.length,
          clients: 1,
          counts: { overdue: 0, attention: base.length, ready: 0 },
          ages: ["18+"],
          positions: ["Quarterback"],
          coaches: [],
        },
      });
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
    setRosterFailure: (value: string) => {
      rosterFailure = value;
    },
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

test("023 normal SDK probe checks scope/pages/details without writes or stored sessions", async ({
  page,
  context,
}) => {
  const f = await fixture(context, true);
  await page.goto("./");
  await connect(page);
  await login(page);
  for (const [button, check] of [
    ["Check signed-in roster scope", "roster scope"],
    ["Check roster paging and filters", "roster pages and filters"],
    ["Check direct athlete detail scope", "roster direct details"],
    ["Check anonymous roster denial", "anonymous roster"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(
      page.getByRole("row").filter({ hasText: check }),
    ).toContainText("passed");
  }
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "anonymous roster" })
      .locator("td")
      .nth(1),
  ).toHaveText("anonymous");
  expect(f.calls.filter((c) => c.startsWith("POST /rest/"))).toEqual(
    expect.arrayContaining([
      "POST /rest/v1/rpc/staff_client_service_roster_page",
    ]),
  );
  expect(
    f.calls.some((c) =>
      /assign_|save_|learning_tick|admin|invite|update|insert|delete/.test(c),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
  await expect(page.getByLabel("Temporary test password")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("023 probe labels missing migration blocked, malformed failed, and clears detail on signout", async ({
  page,
  context,
}) => {
  const f = await fixture(context, true);
  await page.goto("./");
  await connect(page);
  await login(page);
  f.setRosterFailure("missing");
  await page
    .getByRole("button", { name: "Check signed-in roster scope", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster scope" }),
  ).toContainText("blocked");
  await page
    .getByRole("button", { name: "Reset receipt", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Check direct athlete detail scope",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster direct details" }),
  ).toContainText("passed");
  f.setRosterFailure("malformed");
  await page
    .getByRole("button", { name: "Check signed-in roster scope", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster scope" }),
  ).toContainText("failed");
  await page
    .getByRole("button", { name: "Sign out and clear private views" })
    .click();
  await expect(
    page.getByText("Observed response contradicted", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Check signed-in roster scope",
      exact: true,
    }),
  ).toBeDisabled();
});
test("023 parent explicit denial is tested through ordinary authenticated requests", async ({
  page,
  context,
}) => {
  await fixture(context, true);
  await page.goto("./");
  await connect(page);
  await login(page, "parent");
  await page
    .getByRole("button", { name: "Check signed-in roster scope", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster scope" }),
  ).toContainText("passed");
  await expect(
    page.getByRole("button", {
      name: "Check roster paging and filters",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Check direct athlete detail scope",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster direct details" }),
  ).toContainText("passed");
});
test("023 coach cannot pass an unscoped leaked roster", async ({
  page,
  context,
}) => {
  const f = await fixture(context, true);
  await page.goto("./");
  await connect(page);
  await login(page, "coach");
  await page
    .getByRole("button", { name: "Check signed-in roster scope", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster scope" }),
  ).toContainText("passed");
  await page
    .getByRole("button", { name: "Reset receipt", exact: true })
    .click();
  f.setRosterFailure("leak");
  await page
    .getByRole("button", { name: "Check signed-in roster scope", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster scope" }),
  ).toContainText("failed");
});

for (const role of ["owner", "manager", "coach", "other-coach"] as const)
  test(`version2 authorized-label search and hidden-client privacy match for ${role}`, async ({
    page,
    context,
  }) => {
    await fixture(context, true);
    await page.goto("./");
    await connect(page);
    await login(page, role);
    await page
      .getByRole("button", {
        name: "Check roster paging and filters",
        exact: true,
      })
      .click();
    for (const name of [
      "roster search Other",
      "roster visible coach label",
      "roster primary client label",
      "roster other client label",
      "roster pages and filters",
    ])
      await expect(
        page.getByRole("row").filter({ hasText: name }),
      ).toContainText("passed");
    await expect(
      page.getByText("Search probe version 2", { exact: false }),
    ).toBeVisible();
  });
test("version2 exposes a nickname-only mismatch as a specific safe subcheck rather than a blind pass", async ({
  page,
  context,
}) => {
  const f = await fixture(context, true);
  await page.goto("./");
  await connect(page);
  await login(page);
  f.setRosterFailure("nickname-search");
  await page
    .getByRole("button", {
      name: "Check roster paging and filters",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster search Other" }),
  ).toContainText("failed");
  await expect(
    page.getByText(/expected Fictional Jordan, Fictional Other/),
  ).toBeVisible();
  await expect(page.getByText(/observed Fictional Other/)).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Download redacted receipt", exact: true })
      .click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^repformed-test-acceptance-roster-v2-/,
  );
  const json = await readFile((await download.path())!, "utf8");
  const receipt = JSON.parse(json);
  expect(receipt.toolVersion).toBe("roster-search-v2");
  expect(receipt.checks).toContainEqual(
    expect.objectContaining({
      check: "roster search Other",
      result: "failed",
      role: "owner",
    }),
  );
  expect(json).not.toMatch(
    /@example\.test|Bearer|access_token|refresh_token|client_label|Fictional Jordan/,
  );
});
test("version2 rejects matching a hidden client email for a Coach", async ({
  page,
  context,
}) => {
  const f = await fixture(context, true);
  await page.goto("./");
  await connect(page);
  await login(page, "coach");
  f.setRosterFailure("hidden-search");
  await page
    .getByRole("button", {
      name: "Check roster paging and filters",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "roster primary client label" }),
  ).toContainText("failed");
  await expect(
    page.getByText(/expected none.*observed Fictional Avery/),
  ).toBeVisible();
});
