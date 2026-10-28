import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import {
  staffFixture,
  staffState,
  athleteA,
  athleteB,
  coachA,
  coachB,
} from "./staffServiceFixture";
import { fixture, state, uid, staffId } from "./workoutFixture";
import type { StaffMailState } from "../src/staffNotifications";

async function alerts(context: BrowserContext, role = "owner") {
  const roster = staffState();
  if (role === "parent") await fixture(context, state(), role);
  else
    await staffFixture(
      context,
      roster,
      role,
      role === "coach" ? coachA : staffId,
    );
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        staffRosterEnabled: true,
        staffNotificationEmailsEnabled: true,
      },
    }),
  );
  const now = new Date().toISOString();
  const snapshot: StaffMailState = {
    email_enabled: false,
    inapp_observation_enabled: false,
    signup_status: "unconfigured",
    selected: true,
    opted_out: false,
    jobs: [
      {
        id: uid(230),
        profile_id: athleteA,
        athlete_name: "Fictional Jordan",
        kind: "review_overdue",
        state: "accepted",
        attempts: 1,
        due_at: now,
        updated_at: now,
        code: null,
        provider_id: "TEST-provider-reference",
      },
      {
        id: uid(231),
        profile_id: athleteB,
        athlete_name: "Fictional Avery",
        kind: "training_overdue",
        state: "uncertain",
        attempts: 2,
        due_at: now,
        updated_at: now,
        code: "reconcile_required",
        provider_id: null,
      },
    ],
  };
  const calls = {
    reads: 0,
    preferences: 0,
    provider: 0,
    readFailure: false,
    writeFailure: false,
  };
  await context.route("https://api.resend.com/**", (r) => {
    calls.provider++;
    return r.abort();
  });
  await context.route("**/rest/v1/rpc/**", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "staff_notification_workspace") {
      calls.reads++;
      if (calls.readFailure)
        return r.fulfill({
          status: 503,
          json: { message: "TEST status unavailable" },
        });
      const allowed = new Set(
        roster.rows
          .filter((a) => role !== "coach" || a.coach_id === coachA)
          .map((a) => a.athlete_id),
      );
      return r.fulfill({
        json: {
          ...snapshot,
          jobs: snapshot.jobs
            .filter((j) => allowed.has(j.profile_id))
            .map((j) => ({
              ...j,
              provider_id: role === "coach" ? null : j.provider_id,
            })),
        },
      });
    }
    if (name === "set_staff_notification_opt_out") {
      calls.preferences++;
      // Keep the request in flight long enough to exercise the actual UI lock.
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (calls.writeFailure)
        return r.fulfill({
          status: 503,
          json: { message: "TEST preference not saved" },
        });
      snapshot.opted_out = r.request().postDataJSON().opt_out;
      return r.fulfill({ json: null });
    }
    return r.fallback();
  });
  return { snapshot, calls, roster };
}

test("Owner status separates provider acceptance, uncertain outcomes and disabled capabilities", async ({
  page,
  context,
}, info) => {
  const data = await alerts(context);
  await page.goto("./?source=app#workspace");
  const panel = page.getByRole("region", {
    name: "Staff operational email status",
  });
  await expect(panel).toContainText("Staff email dispatch disabled");
  await expect(panel).toContainText(
    "Provider accepted · inbox delivery not confirmed",
  );
  await expect(panel).toContainText(
    "Outcome uncertain · reconcile before resending",
  );
  await expect(panel).toContainText("New-signup alerts are unconfigured");
  await expect(panel).toContainText("Automatic in-app observation disabled");
  await expect(panel).toContainText("TEST-provider-reference");
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(panel.getByRole("button")).toHaveCount(2);
  expect(data.calls.provider).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[aria-label="Staff operational email status"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await mkdir("artifacts/staff-notifications", { recursive: true });
  await panel.screenshot({
    path: `artifacts/staff-notifications/status-${info.project.name}.png`,
    style: ".app-header,.app-tabs{visibility:hidden !important}",
  });
});

test("Manager preference is locked on repeated clicks and persists across refresh", async ({
  page,
  context,
}) => {
  const data = await alerts(context, "manager");
  await page.goto("./?source=app#workspace");
  const panel = page.getByRole("region", {
    name: "Staff operational email status",
  });
  await expect(panel).toContainText("Fictional Avery");
  await panel.getByRole("button", { name: "Pause my staff emails" }).dblclick();
  await expect(panel.getByRole("status")).toContainText(
    "No email was sent by this action",
  );
  await expect(
    panel.getByRole("button", { name: "Resume my selected staff emails" }),
  ).toBeVisible();
  expect(data.calls.preferences).toBe(1);
  expect(data.snapshot.opted_out).toBe(true);
  await page.reload();
  await expect(panel).toContainText("You have paused");
  await panel
    .getByRole("button", { name: "Resume my selected staff emails" })
    .click();
  await expect(
    panel.getByRole("button", { name: "Pause my staff emails" }),
  ).toBeVisible();
  expect(data.calls.preferences).toBe(2);
  expect(data.calls.provider).toBe(0);
});

test("Coach renders only scoped jobs and clears revoked assignment results on refresh", async ({
  page,
  context,
}) => {
  const data = await alerts(context, "coach");
  await page.goto("./?source=app#workspace");
  const panel = page.getByRole("region", {
    name: "Staff operational email status",
  });
  await expect(panel).toContainText("Fictional Jordan");
  await expect(panel).not.toContainText("Fictional Avery");
  await expect(panel).not.toContainText("TEST-provider-reference");
  data.roster.rows.find((r) => r.athlete_id === athleteA)!.coach_id = coachB;
  await panel
    .getByRole("button", { name: "Refresh staff email status" })
    .click();
  await expect(panel).toContainText("No operational email attempts recorded");
  await expect(panel).not.toContainText("Fictional Jordan");
});

test("Status and preference failures are honest, retryable and do not retain stale job data", async ({
  page,
  context,
}) => {
  const data = await alerts(context);
  await page.goto("./?source=app#workspace");
  const panel = page.getByRole("region", {
    name: "Staff operational email status",
  });
  await expect(panel).toContainText("Fictional Jordan");
  data.calls.writeFailure = true;
  await panel.getByRole("button", { name: "Pause my staff emails" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "TEST preference not saved",
  );
  await expect(panel.getByRole("status")).toHaveCount(0);
  expect(data.snapshot.opted_out).toBe(false);
  data.calls.readFailure = true;
  await panel
    .getByRole("button", { name: "Refresh staff email status" })
    .click();
  await expect(panel.getByRole("alert")).toContainText(
    "TEST status unavailable",
  );
  await expect(panel).not.toContainText("Fictional Jordan");
  data.calls.readFailure = false;
  data.snapshot.selected = false;
  await panel
    .getByRole("button", { name: "Refresh staff email status" })
    .click();
  await expect(panel).toContainText(
    "No staff email recipient selection exists",
  );
  await expect(
    panel.getByRole("button", { name: "Pause my staff emails" }),
  ).toHaveCount(0);
  expect(data.calls.provider).toBe(0);
});

test("Parent workspace never loads the staff email projection even with its UI feature flag enabled", async ({
  page,
  context,
}) => {
  const data = await alerts(context, "parent");
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("heading", { name: "Today’s training.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Staff operational email status" }),
  ).toHaveCount(0);
  expect(data.calls.reads).toBe(0);
  expect(data.calls.preferences).toBe(0);
});
