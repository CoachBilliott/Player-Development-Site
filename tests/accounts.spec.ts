import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const parentId = "10000000-0000-4000-8000-000000000001";
const otherId = "20000000-0000-4000-8000-000000000002";
type Row = Record<string, unknown>;
function jwt(id: string) {
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fictional-signature`;
}
function fixture(under18Enabled = true) {
  const accounts = new Map<string, Row>();
  const players = new Map<string, Row>();
  const counts = { writes: 0, signup: 0, recover: 0, password: 0, resend: 0 };
  let failNextSave = false;
  let ambiguousSave = false;
  const user = (id: string) => ({
    id,
    aud: "authenticated",
    role: "authenticated",
    email:
      id === parentId
        ? "fictional-parent@example.test"
        : "fictional-adult@example.test",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  });
  async function install(context: BrowserContext) {
    await context.route("**/content-config.json", (route) =>
      route.fulfill({
        json: {
          enabled: true,
          membersEnabled: true,
          url: "https://member-fixture.supabase.co",
          publishableKey: "sb_publishable_fixture_only",
        },
      }),
    );
    await context.route(
      "https://member-fixture.supabase.co/**",
      async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          method = req.method();
        const body = req.postData() ? req.postDataJSON() : {};
        const bearer = req.headers().authorization?.slice(7);
        const id = bearer?.includes(".")
          ? JSON.parse(
              Buffer.from(bearer.split(".")[1], "base64url").toString(),
            ).sub
          : parentId;
        const singular = req
          .headers()
          .accept?.includes("application/vnd.pgrst.object+json");
        if (url.pathname.endsWith("/token")) {
          const loginId = body.email?.includes("adult") ? otherId : parentId;
          return route.fulfill({
            json: {
              access_token: jwt(loginId),
              refresh_token: "fictional-refresh",
              expires_in: 3600,
              token_type: "bearer",
              user: user(loginId),
            },
          });
        }
        if (url.pathname.endsWith("/signup")) {
          counts.signup++;
          return route.fulfill({ json: user(parentId) });
        }
        if (url.pathname.endsWith("/resend")) {
          counts.resend++;
          return route.fulfill({ json: {} });
        }
        if (url.pathname.endsWith("/recover")) {
          counts.recover++;
          return route.fulfill({ json: {} });
        }
        if (url.pathname.endsWith("/user")) {
          if (method === "PUT") counts.password++;
          return route.fulfill({ json: user(id) });
        }
        if (url.pathname.endsWith("/logout"))
          return route.fulfill({ status: 204, body: "" });
        if (
          url.pathname.includes("/coach_members") ||
          url.pathname.includes("/training_resources")
        )
          return route.fulfill({ json: [] });
        if (url.pathname.endsWith("/rpc/complete_member_account")) {
          const account = {
            user_id: id,
            account_type: body.kind,
            privacy_version: "profile-pilot-2026-10",
          };
          accounts.set(id, account);
          return route.fulfill({ json: account });
        }
        if (url.pathname.endsWith("/rpc/delete_member_data")) {
          accounts.delete(id);
          for (const [key, player] of players)
            if (player.owner_id === id) players.delete(key);
          return route.fulfill({ status: 204, body: "" });
        }
        if (url.pathname.includes("/profile_settings"))
          return route.fulfill({ json: { under18_enabled: under18Enabled } });
        if (url.pathname.includes("/member_accounts"))
          return route.fulfill({
            json: accounts.has(id) ? [accounts.get(id)] : [],
          });
        if (url.pathname.includes("/player_profiles")) {
          const playerId = url.searchParams.get("id")?.replace(/^eq\./, "");
          const version = Number(
            url.searchParams.get("version")?.replace(/^eq\./, ""),
          );
          if (method === "GET")
            return route.fulfill({
              json: [...players.values()].filter(
                (p) => p.owner_id === id && (!playerId || p.id === playerId),
              ),
            });
          if (failNextSave) {
            failNextSave = false;
            return route.fulfill({
              status: 403,
              json: { message: "Simulated rejected save" },
            });
          }
          counts.writes++;
          if (method === "POST") {
            const row = { ...body, owner_id: id, version: 1 };
            players.set(row.id, row);
            if (ambiguousSave) {
              ambiguousSave = false;
              return route.fulfill({
                status: 409,
                json: { message: "Simulated lost response after commit" },
              });
            }
            return route.fulfill({ status: 201, json: singular ? row : [row] });
          }
          const old = playerId && players.get(playerId);
          if (!old || old.owner_id !== id || old.version !== version)
            return route.fulfill({ json: [] });
          if (method === "PATCH") {
            const row = { ...old, ...body, version: version + 1 };
            players.set(playerId!, row);
            return route.fulfill({ json: singular ? row : [row] });
          }
          players.delete(playerId!);
          return route.fulfill({
            json: singular ? { id: playerId } : [{ id: playerId }],
          });
        }
        return route.fulfill({
          status: 404,
          json: { message: "Unexpected fixture request" },
        });
      },
    );
  }
  return {
    install,
    counts,
    players,
    accounts,
    rejectSave: () => {
      failNextSave = true;
    },
    loseSaveResponse: () => {
      ambiguousSave = true;
    },
  };
}
async function signIn(
  page: import("@playwright/test").Page,
  email = "fictional-parent@example.test",
) {
  await page.goto("./#account");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Adult email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-only");
  await page.getByRole("button", { name: "Sign in securely" }).click();
}
async function setup(
  page: import("@playwright/test").Page,
  kind: "parent" | "adult" = "parent",
) {
  await page.getByLabel("Account type").selectOption(kind);
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "Finish account setup" }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh start for your players." }),
  ).toBeVisible();
}
test("unconfigured public member entry is honest and collects no profile data", async ({
  page,
}) => {
  await page.goto("./#account");
  await expect(
    page.getByRole("heading", {
      name: "Private profiles are being connected.",
    }),
  ).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Try the sample demo" }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("parent profiles support private create, edit, cancel, repeated clicks, refresh, cross-device access and deletion", async ({
  page,
  context,
  browser,
}) => {
  const backend = fixture();
  await backend.install(context);
  await page.addInitScript(() =>
    localStorage.setItem(
      "pd-demo-v1",
      JSON.stringify({
        version: 1,
        profile: {
          id: "morgan",
          name: "Morgan",
          age: "18+",
          position: "Quarterback",
          level: "Experienced",
          goal: "Footwork",
          guardian: false,
        },
        history: [],
        custom: [],
        run: null,
      }),
    ),
  );
  await signIn(page);
  await setup(page);
  await page.getByRole("button", { name: "Add your first player" }).click();
  await page.getByLabel("Player nickname").fill("Fictional Comet");
  await page.getByLabel("Age group", { exact: true }).selectOption("8–12");
  await page.getByRole("checkbox").check();
  backend.loseSaveResponse();
  await page.getByRole("button", { name: "Save private player" }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Fictional Comet", exact: true }),
  ).toBeVisible();
  expect(backend.counts.writes).toBe(1);
  await page.getByRole("button", { name: "Edit Fictional Comet" }).click();
  await page.getByLabel("Player nickname").fill("Discarded draft");
  await page.getByRole("button", { name: "Cancel changes" }).click();
  expect(backend.counts.writes).toBe(1);
  await page.getByRole("button", { name: "Edit Fictional Comet" }).click();
  await page.getByLabel("Primary goal").selectOption("Ball skills");
  await page.getByRole("button", { name: "Save private player" }).click();
  await expect(page.getByText("Private player profile saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Fictional Comet", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ball skills", { exact: true })).toBeVisible();
  const localState = JSON.parse(
    (await page.evaluate(() => localStorage.getItem("pd-demo-v1")))!,
  );
  expect(JSON.stringify(localState)).not.toContain("Fictional Comet");
  expect(localState.profile.name).toBe("Morgan");
  await expect(page.locator("main").getByText("Morgan")).toHaveCount(0);
  const second = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  await backend.install(second);
  const partner = await second.newPage();
  await signIn(partner);
  await expect(
    partner.getByRole("heading", { name: "Fictional Comet", exact: true }),
  ).toBeVisible();
  await second.close();
  await page.getByRole("button", { name: "Delete Fictional Comet" }).click();
  await page.getByRole("button", { name: "Keep profile" }).click();
  expect(backend.players.size).toBe(1);
  await page.getByRole("button", { name: "Delete Fictional Comet" }).click();
  await page
    .getByRole("button", { name: "Delete player profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A fresh start for your players." }),
  ).toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.goto(new URL("#account", page.url()).href);
  await expect(
    otherTab.getByRole("button", { name: "Sign out of this browser" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out of this browser" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await expect(
    otherTab.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await otherTab.close();
});
test("signup verifies email, recovery updates a password and adult accounts cannot add minors", async ({
  page,
  context,
}) => {
  const backend = fixture();
  await backend.install(context);
  await page.goto("./#account");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel("Adult email", { exact: true })
    .fill("fictional-parent@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-only");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create adult account" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(backend.counts.signup).toBe(1);
  // The real SDK created a PKCE verifier. Intercept only the service response,
  // then exercise the actual callback exchange and URL cleanup.
  await page.goto("./?code=fictional-verification-code#account");
  await expect(page.getByLabel("Account type")).toBeVisible();
  await expect(page).not.toHaveURL(/code=/);
  await setup(page, "adult");
  await page.getByRole("button", { name: "Add your first player" }).click();
  await expect(
    page.getByLabel("Age group", { exact: true }).locator("option"),
  ).toHaveText(["18+"]);
  await page.getByRole("button", { name: "Cancel changes" }).click();
  await page.getByRole("button", { name: "Sign out of this browser" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page
    .getByLabel("Adult email", { exact: true })
    .fill("fictional-parent@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  expect(backend.counts.recover).toBe(1);
  await page.goto("./?flow=recovery&code=fictional-recovery-code#account");
  await page
    .getByLabel("New password", { exact: true })
    .fill("another-fictional-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  expect(backend.counts.password).toBe(1);
  await expect(page).not.toHaveURL(/flow=|code=/);
});
test("failed saves preserve drafts; signout and switching accounts expose no previous profiles; member deletion is explicit", async ({
  page,
  context,
}) => {
  const backend = fixture();
  await backend.install(context);
  await signIn(page);
  await setup(page);
  await page.getByRole("button", { name: "Add your first player" }).click();
  await page.getByLabel("Player nickname").fill("Fictional Private");
  backend.rejectSave();
  await page.getByRole("button", { name: "Save private player" }).click();
  await expect(page.getByRole("alert")).toContainText("Save was not confirmed");
  await expect(page.getByLabel("Player nickname")).toHaveValue(
    "Fictional Private",
  );
  await page.getByRole("button", { name: "Save private player" }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional Private", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out of this browser" }).click();
  await signIn(page, "fictional-adult@example.test");
  await setup(page, "adult");
  await expect(
    page.getByRole("heading", { name: "Fictional Private", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out of this browser" }).click();
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Fictional Private", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete member profile data", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep my data" }).click();
  expect(backend.players.size).toBe(1);
  await page
    .getByRole("button", { name: "Delete member profile data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Permanently delete profile data" }),
  ).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete profile data" })
    .click();
  await expect(page.getByLabel("Account type")).toBeVisible();
  expect(backend.players.size).toBe(0);
  expect(backend.accounts.has(otherId)).toBe(true);
});
test("member forms and private dashboard fit small phones and pass automated accessibility checks", async ({
  page,
  context,
}, testInfo) => {
  const backend = fixture();
  await backend.install(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (testInfo.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("./#account");
  const check = async () => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
    ).toEqual([]);
  };
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await check();
  await page.screenshot({
    path: `artifacts/member-signin-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await signIn(page);
  await setup(page);
  await check();
  await page.getByRole("button", { name: "Add your first player" }).click();
  await check();
  await page.getByLabel("Player nickname").fill("Fictional Champ");
  await page.getByLabel("Age group", { exact: true }).selectOption("5–7");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save private player" }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional Champ", exact: true }),
  ).toBeVisible();
  await check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/member-dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Profile privacy details", exact: true })
    .click();
  await check();
});

test("expired email callbacks recover safely and the closed under-18 gate is reflected in the editor", async ({
  page,
  context,
}) => {
  const backend = fixture(false);
  await backend.install(context);
  await page.goto(
    "./?error=access_denied&error_description=fictional-expired-link#account",
  );
  await expect(page.getByRole("alert")).toContainText("invalid or expired");
  await expect(page).not.toHaveURL(/error=/);
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await page
    .getByLabel("Adult email", { exact: true })
    .fill("fictional-parent@example.test");
  await page
    .getByRole("button", { name: "Resend verification link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "fresh verification link",
  );
  expect(backend.counts.resend).toBe(1);
  await signIn(page);
  await setup(page);
  await page.getByRole("button", { name: "Add your first player" }).click();
  await expect(
    page.getByLabel("Age group", { exact: true }).locator("option"),
  ).toHaveText(["18+"]);
  await expect(
    page.getByText("Under-18 enrollment is not open yet.", { exact: false }),
  ).toBeVisible();
});
