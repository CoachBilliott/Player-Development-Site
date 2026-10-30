import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, state, accountId, staffId } from "./workoutFixture";
const inviteId = "b1000000-0000-4000-8000-000000000010";
const requestId = "b1000000-0000-4000-8000-000000000020";
type Row = Record<string, unknown>;
async function lifecycle(
  context: BrowserContext,
  role = "owner",
  invited = false,
) {
  await fixture(context, state(), role === "owner" ? "owner" : "parent");
  const userId = role === "owner" ? staffId : accountId;
  const email =
    role === "owner"
      ? "fictional-staff@example.test"
      : "fictional-parent@example.test";
  const data = {
    role: invited ? (null as string | null) : role,
    pending: invited
      ? ({
          id: inviteId,
          intended_role: "coach",
          state: "sent",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        } as Row | null)
      : null,
    invites: [] as Row[],
    sent: 0,
    cancels: 0,
    deletes: 0,
    accepts: 0,
    deliveryFailure: false,
    deletionFailure: false,
    closure: {
      eligible: role !== "owner",
      reason: role === "owner" ? "owner_transfer" : "",
      request_id: null as string | null,
      state: "none",
      profile_count: 1,
      video_count: 1,
    },
  };
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fictional-signature`;
  const user = {
    id: userId,
    email,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        membersEnabled: true,
        membersSignupEnabled: false,
        accountLifecycleEnabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
      },
    }),
  );
  await context.route(
    "https://separate-demo.supabase.co/rest/v1/account_roles**",
    (r) =>
      r.fulfill({ json: data.role ? [{ role: data.role, version: 1 }] : [] }),
  );
  await context.route(
    "https://separate-demo.supabase.co/auth/v1/token**",
    async (r) => {
      const body = r.request().postDataJSON();
      if (body.password !== "CorrectPass1!")
        return r.fulfill({
          status: 400,
          json: {
            error: "invalid_grant",
            error_description: "Fictional incorrect password",
          },
        });
      return r.fulfill({
        json: {
          access_token: token,
          refresh_token: "fictional-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
    },
  );
  await context.route(
    "https://separate-demo.supabase.co/rest/v1/rpc/*",
    async (r) => {
      const name = new URL(r.request().url()).pathname.split("/").at(-1);
      const body = r.request().postData() ? r.request().postDataJSON() : {};
      if (name === "my_account_invitation")
        return r.fulfill({ json: data.pending });
      if (name === "list_account_invitations")
        return r.fulfill({ json: data.invites });
      if (name === "list_account_closure_requests")
        return r.fulfill({ json: [] });
      if (name === "account_lifecycle_state")
        return r.fulfill({ json: data.closure });
      if (name === "cancel_account_invitation") {
        data.cancels++;
        const row = data.invites.find((i) => i.id === body.invitation)!;
        row.state = "cancelled";
        row.version = Number(row.version) + 1;
        return r.fulfill({ json: null });
      }
      if (name === "accept_account_invitation") {
        data.accepts++;
        data.role = String(data.pending!.intended_role);
        data.pending = null;
        return r.fulfill({ json: null });
      }
      if (name === "request_account_closure_help") {
        data.closure.state = "assistance_requested";
        data.closure.request_id = requestId;
        return r.fulfill({ json: requestId });
      }
      return r.fallback();
    },
  );
  await context.route(
    "https://separate-demo.supabase.co/functions/v1/account-lifecycle",
    async (r) => {
      const body = r.request().postDataJSON();
      if (body.action === "invite") {
        data.sent++;
        const row = {
          id: body.requestId,
          email: body.email,
          intended_role: body.role,
          state: data.deliveryFailure ? "failed" : "sent",
          delivery_code: data.deliveryFailure ? "mail_setup_required" : "sent",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          version: 1,
        };
        if (!data.invites.some((i) => i.id === row.id)) data.invites.push(row);
        return r.fulfill({ json: { invitation: row } });
      }
      data.deletes++;
      if (data.deletionFailure) {
        data.closure.state = "failed";
        data.closure.request_id = body.requestId;
        return r.fulfill({
          status: 409,
          json: {
            error:
              "Deletion is unfinished. Access is paused while cleanup is pending. Keep this request and retry.",
          },
        });
      }
      expect(r.request().headers().authorization).toBe(`Bearer ${token}`);
      return r.fulfill({
        json: { deleted: true, requestId: body.requestId, receiptSaved: true },
      });
    },
  );
  return data;
}

async function account(page: import("@playwright/test").Page, role = "owner") {
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("heading", {
      name: role === "owner" ? "Athletes." : "Today’s training.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Account", exact: true })
    .click();
  await page.getByText("Manage account closure", { exact: true }).click();
}
test("Owner reviews an invitation, canceling is harmless, repeated confirmation sends one request", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context);
  await account(page);
  await page.goto("./?source=app&accessSection=invites#access");
  await page.getByLabel("Email address").fill("partner@example.test");
  await expect(page.getByLabel("Role").locator("option")).toHaveText([
    "Coach",
    "Manager",
  ]);
  await page.getByLabel("Role").selectOption("coach");
  await expect(
    page.getByLabel("Role").locator('option[value="owner"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Send invite", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing invitation" }).click();
  expect(data.sent).toBe(0);
  await page.getByRole("button", { name: "Send invite", exact: true }).click();
  await page.getByRole("button", { name: "Confirm invite" }).dblclick();
  await expect(
    page.getByText("Awaiting recipient", { exact: true }),
  ).toBeVisible();
  expect(data.sent).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Staff & settings." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Invite staff", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByText("Invitation history & account requests", { exact: true })
    .click();
  await expect(
    page.getByText("Awaiting recipient", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel invitation for partner@example.test" })
    .click();
  await page
    .getByRole("button", { name: "Keep invitation", exact: true })
    .click();
  expect(data.cancels).toBe(0);
  await page
    .getByRole("button", { name: "Cancel invitation for partner@example.test" })
    .click();
  await page.getByRole("button", { name: "Confirm cancel invitation" }).click();
  await expect(page.getByText("Canceled", { exact: true })).toBeVisible();
  expect(data.cancels).toBe(1);
  expect(data.invites[0].state).toBe("cancelled");
});

test("Owner can invite a Manager through the concise staff form", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context);
  await account(page);
  await page.goto("./?source=app&accessSection=invites#access");
  await page.getByLabel("Email address").fill("fictional-manager@example.test");
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("manager");
  await page.getByRole("button", { name: "Send invite", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Manager");
  await page
    .getByRole("button", { name: "Confirm invite", exact: true })
    .dblclick();
  await expect(
    page.getByText("Awaiting recipient", { exact: true }),
  ).toBeVisible();
  expect(data.sent).toBe(1);
  expect(data.invites[0].intended_role).toBe("manager");
});
for (const role of ["parent", "athlete"]) {
  test(`separate adult-member invitation retains ${role} access without adding Owner invitation`, async ({
    page,
    context,
  }) => {
    const data = await lifecycle(context);
    await account(page);
    await page.goto("./?source=app&accessSection=invites#access");
    await page
      .getByRole("button", {
        name: "Invite an adult member instead",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("Role").locator("option")).toHaveText([
      "Parent",
      "Athlete · individual adult",
    ]);
    await page
      .getByLabel("Email address")
      .fill(`fictional-${role}@example.test`);
    await page
      .getByRole("combobox", { name: "Role", exact: true })
      .selectOption(role);
    await page
      .getByRole("button", { name: "Send invite", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm invite", exact: true })
      .click();
    await expect(
      page.getByText("Awaiting recipient", { exact: true }),
    ).toBeVisible();
    expect(data.sent).toBe(1);
    expect(data.invites[0].intended_role).toBe(role);
  });
}

test.describe("US display formats preserve the browser time zone", () => {
  test.use({ locale: "en-GB", timezoneId: "America/Chicago" });
  test("invitation history uses month/day/year and Chicago local time even with a British device locale", async ({
    page,
    context,
  }) => {
    const data = await lifecycle(context);
    data.invites.push({
      id: inviteId,
      email: "fictional-staff@example.test",
      intended_role: "coach",
      state: "sent",
      delivery_code: "sent",
      created_at: "2026-04-13T18:00:00Z",
      updated_at: "2026-04-13T18:00:00Z",
      expires_at: "2026-04-20T18:00:00Z",
      version: 1,
    });
    await account(page);
    await page.goto("./?source=app&accessSection=invites#access");
    await page
      .getByText("Invitation history & account requests", { exact: true })
      .click();
    const record = page
      .locator(".lifecycle-list li")
      .filter({ hasText: "fictional-staff@example.test" });
    await expect(record).toContainText("Requested 4/13/2026");
    await expect(record).toContainText(/1:00:00\s?PM/);
    expect(data.invites[0].created_at).toBe("2026-04-13T18:00:00Z");
    expect(data.sent).toBe(0);
  });
});
test("email service failure does not pretend delivery succeeded", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context);
  data.deliveryFailure = true;
  await account(page);
  await page.goto("./?source=app&accessSection=invites#access");
  await page.getByLabel("Email address").fill("partner@example.test");
  await page.getByRole("button", { name: "Send invite", exact: true }).click();
  await page.getByRole("button", { name: "Confirm invite" }).click();
  await expect(
    page.getByText("Email request failed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry invitation email" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Awaiting recipient", { exact: true }),
  ).toHaveCount(0);
});
test("an invited Coach accepts exactly the invited access without choosing Parent or Athlete", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context, "parent", true);
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("heading", { name: "Your invited level: Coach" }),
  ).toBeVisible();
  await expect(page.getByLabel("Account type")).toHaveCount(0);
  const accept = page.getByRole("button", {
    name: "Accept invitation & open my account",
  });
  await expect(accept).toBeDisabled();
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await accept.dblclick();
  await expect(
    page.getByRole("heading", { name: "Your athletes." }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account settings." }),
  ).toBeVisible();
  expect(data.accepts).toBe(1);
});
test("cancelled invitations cannot fall through to profile setup", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context, "parent", true);
  data.pending!.state = "cancelled";
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("heading", { name: "Your invitation is not active." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finish account setup" }),
  ).toHaveCount(0);
});
test("customer deletion requires confirmation and password, with no action on cancel or incorrect password", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context, "parent");
  await account(page, "parent");
  await page
    .getByRole("button", { name: "Review account deletion", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep my account", exact: true })
    .click();
  expect(data.deletes).toBe(0);
  await page
    .getByRole("button", { name: "Review account deletion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Delete my account permanently" }),
  ).toBeDisabled();
  await page
    .getByLabel("Current password to delete this account")
    .fill("WrongPass1!");
  await page
    .getByLabel("Type DELETE to confirm this account action")
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Delete my account permanently" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "password was not confirmed",
  );
  expect(data.deletes).toBe(0);
  await expect(
    page.getByLabel("Current password to delete this account"),
  ).toHaveValue("");
});
test("confirmed deletion clears private UI and produces one request on repeated clicks", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context, "parent");
  await account(page, "parent");
  await page
    .getByRole("button", { name: "Review account deletion", exact: true })
    .click();
  await page
    .getByLabel("Current password to delete this account")
    .fill("CorrectPass1!");
  await page
    .getByLabel("Type DELETE to confirm this account action")
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Delete my account permanently" })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "login and customer account were deleted",
  );
  expect(data.deletes).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Fictional Pilot", exact: true }),
  ).toHaveCount(0);
});
test("a failed cleanup keeps a retryable deletion request and does not display success", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context, "parent");
  data.deletionFailure = true;
  await account(page, "parent");
  await page
    .getByRole("button", { name: "Review account deletion", exact: true })
    .click();
  await page
    .getByLabel("Current password to delete this account")
    .fill("CorrectPass1!");
  await page
    .getByLabel("Type DELETE to confirm this account action")
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Delete my account permanently" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Deletion is unfinished",
  );
  await page
    .getByRole("button", {
      name: "Close without canceling deletion",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Refresh deletion status", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Continue account deletion",
      exact: true,
    }),
  ).toBeVisible();
});
test("Owner closure creates a review request and never calls automatic deletion", async ({
  page,
  context,
}) => {
  const data = await lifecycle(context);
  await account(page);
  await page
    .getByRole("button", {
      name: "Request assisted account closure",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Current password to delete this account"),
  ).toHaveCount(0);
  await page
    .getByLabel("Type DELETE to confirm this account action")
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Confirm closure review request" })
    .click();
  await expect(page.getByRole("status")).toContainText("account remains open");
  expect(data.deletes).toBe(0);
});
test("invitation and account controls fit phones and pass WCAG checks", async ({
  page,
  context,
}) => {
  await lifecycle(context);
  await account(page);
  await page.goto("./?source=app&accessSection=invites#access");
  await page
    .getByLabel("Email address")
    .fill("fictional-partner-with-a-long-email@example.test");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
