import { disableBackend } from "./backendFixture";
import { test, expect, type BrowserContext } from "@playwright/test";

type Row = {
  id: string;
  content: Record<string, unknown>;
  asset_path: string;
  asset_type: string;
  asset_name: string;
  version: number;
  status: string;
};
const userId = "10000000-0000-4000-8000-000000000001";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "coach@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
function token() {
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fictional-signature`;
}
async function mockProject(
  context: BrowserContext,
  rows: Map<string, Row>,
  approved = true,
  ambiguousWrites = false,
) {
  await context.route("**/content-config.json", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
      },
    }),
  );
  await context.route("https://separate-demo.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = request.headers();
    const singular = headers.accept?.includes(
      "application/vnd.pgrst.object+json",
    );
    if (url.pathname.endsWith("/token"))
      return route.fulfill({
        json: {
          access_token: token(),
          refresh_token: "fictional-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
    if (url.pathname.endsWith("/logout"))
      return route.fulfill({ status: 204, body: "" });
    if (url.pathname.includes("/rest/v1/account_roles"))
      return route.fulfill({
        json: approved
          ? [{ role: "coach", version: 1 }]
          : [{ role: "parent", version: 1 }],
      });
    if (url.pathname.includes("/rest/v1/coach_members"))
      return route.fulfill({ json: approved ? [{ user_id: userId }] : [] });
    if (url.pathname.includes("/rest/v1/training_resources")) {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const version = url.searchParams.get("version")?.replace(/^eq\./, "");
      if (method === "GET")
        return route.fulfill({
          json: (id
            ? rows.has(id)
              ? [rows.get(id)!]
              : []
            : [...rows.values()]
          ).map((row) => ({
            ...row,
            content: Object.fromEntries(Object.entries(row.content).sort()),
          })),
        });
      if (method === "POST") {
        const body = request.postDataJSON();
        const row = { ...body, version: 1, created_by: userId };
        rows.set(row.id, row);
        if (ambiguousWrites)
          return route.fulfill({
            status: 502,
            json: {
              message: "Simulated lost publication response after commit",
            },
          });
        return route.fulfill({ status: 201, json: singular ? row : [row] });
      }
      const old = id && rows.get(id);
      if (!old || old.version !== Number(version))
        return route.fulfill({ json: [] });
      if (method === "PATCH") {
        const next = {
          ...old,
          ...request.postDataJSON(),
          version: old.version + 1,
        };
        rows.set(old.id, next);
        if (ambiguousWrites)
          return route.fulfill({
            status: 502,
            json: { message: "Simulated lost edit response after commit" },
          });
        return route.fulfill({ json: singular ? next : [next] });
      }
      if (method === "DELETE") {
        rows.delete(old.id);
        return route.fulfill({
          json: singular ? { id: old.id } : [{ id: old.id }],
        });
      }
    }
    if (url.pathname.includes("/storage/v1/object/sign/"))
      return route.fulfill({
        json: {
          signedURL:
            url.pathname.replace("/storage/v1", "") + "?token=fictional",
        },
      });
    if (url.pathname.includes("/storage/v1/object/") && method === "POST")
      return route.fulfill({
        json: { Key: url.pathname, Id: "fictional-file" },
      });
    if (
      url.pathname.endsWith("/storage/v1/object/training-media") &&
      method === "DELETE"
    )
      return route.fulfill({ json: [] });
    return route.fulfill({
      status: 500,
      json: { message: `Unexpected test request: ${method} ${url.pathname}` },
    });
  });
}
async function sharedSignIn(page: import("@playwright/test").Page) {
  await page.goto("./#coach");
  await expect(
    page.getByRole("button", { name: "Shared website", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Coach email").fill("coach@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-demo-password");
  await page.getByRole("button", { name: "Sign in to publish" }).click();
}

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

test("connected upload space opens on shared publishing and offers a clearly local practice mode", async ({
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
  await page
    .getByRole("button", { name: "Try a practice upload without signing in" })
    .click();
  await expect(
    page.getByRole("button", { name: "This browser", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(
      "Practice mode: uploads stay in this browser. Your partner will not see them.",
    ),
  ).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "Coach sign-in", exact: true }),
  ).toBeVisible();
  expect(rows.size).toBe(0);
});
