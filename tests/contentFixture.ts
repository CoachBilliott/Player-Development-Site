import { type BrowserContext, type Page } from "@playwright/test";
export type Row = {
  id: string;
  content: Record<string, unknown>;
  asset_path: string;
  asset_type: string;
  asset_name: string;
  version: number;
  status: string;
  visibility: "public_sample" | "member_only";
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
function token(subject = userId) {
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: subject, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fictional-signature`;
}
export async function mockProject(
  context: BrowserContext,
  rows: Map<string, Row>,
  approved = true,
  ambiguousWrites = false,
  identity = userId,
) {
  const actor = { ...user, id: identity };
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
          access_token: token(identity),
          refresh_token: "fictional-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: actor,
        },
      });
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: actor });
    if (url.pathname.endsWith("/logout"))
      return route.fulfill({ status: 204, body: "" });
    if (url.pathname.includes("/rest/v1/account_roles"))
      return route.fulfill({
        json: approved
          ? [{ role: "coach", version: 1 }]
          : [{ role: "parent", version: 1 }],
      });
    if (url.pathname.includes("/rest/v1/coach_members"))
      return route.fulfill({ json: approved ? [{ user_id: identity }] : [] });
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
          )
            .filter(
              (row) =>
                row.visibility !== "member_only" ||
                headers.authorization?.includes(".fictional-signature"),
            )
            .map((row) => ({
              ...row,
              content: Object.fromEntries(Object.entries(row.content).sort()),
            })),
        });
      if (method === "POST") {
        const body = request.postDataJSON();
        const row = { ...body, version: 1, created_by: identity };
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
export async function sharedSignIn(page: import("@playwright/test").Page) {
  await page.goto("./#coach");
  await page.getByLabel("Coach email").fill("coach@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-demo-password");
  await page.getByRole("button", { name: "Sign in to publish" }).click();
}

export async function openLocalStudio(page: Page) {
  await mockProject(page.context(), new Map());
  await page.goto("./#coach");
  await page.reload();
  await sharedSignIn(page);
  await page.getByRole("button", { name: "This browser", exact: true }).click();
  await page.getByRole("button", { name: "Switch destination" }).click();
}
