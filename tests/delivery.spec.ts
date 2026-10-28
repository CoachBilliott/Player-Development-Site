import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  staffFixture,
  staffState,
  athleteA,
  coachA,
} from "./staffServiceFixture";
import { fixture, state, uid, profileId } from "./workoutFixture";
import { draftDeliveryRule } from "../src/deliveryRules";
import type { ContentNotice, DeliveryWorkspace } from "../src/delivery";
import { mkdir } from "node:fs/promises";
async function notifications(context: BrowserContext, role = "owner") {
  const d: DeliveryWorkspace = {
    manual_only: true,
    email_adapter: "disabled",
    enabled: true,
    packages: [
      {
        id: uid(200),
        title: "TEST package · draft",
        rule: { ...draftDeliveryRule },
        version: 1,
      },
    ],
    client: {
      package_id: uid(200),
      overrides: { time: "09:00" },
      state: "active",
      version: 1,
    },
    athlete: null,
    effective_rule: { ...draftDeliveryRule, time: "09:00" },
    checks: [
      {
        id: uid(201),
        cycle_key: "TEST weekly training",
        due_at: new Date(Date.now() - 86400000).toISOString(),
        notice_not_before: new Date(Date.now() - 86400000).toISOString(),
        rule_snapshot: { ...draftDeliveryRule },
        state: "active",
        last_checked_at: new Date(Date.now() - 3600000).toISOString(),
        first_observed_available_at: null,
        available_now: false,
        alert: { state: "open", escalated_at: null, episode: 1 },
      },
    ],
  };
  const inbox: ContentNotice[] = [
    {
      id: uid(202),
      profile_id: profileId,
      athlete_name: "Fictional Pilot",
      kind: "training_ready",
      observed_at: new Date().toISOString(),
      read_at: null,
      email_status: "disabled",
      available_now: true,
    },
    {
      id: uid(203),
      profile_id: profileId,
      athlete_name: "Fictional Pilot",
      kind: "review_ready",
      observed_at: new Date().toISOString(),
      read_at: null,
      email_status: "disabled",
      available_now: true,
    },
  ];
  const counts = { checks: 0, saves: 0, reads: 0 };
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        staffRosterEnabled: true,
        deliveryMonitoringEnabled: true,
      },
    }),
  );
  const names = [
    "delivery_profile_workspace",
    "delivery_staff_queue",
    "evaluate_delivery_checks",
    "acknowledge_delivery_alert",
    "save_delivery_package",
    "save_delivery_override",
    "plan_delivery_check",
    "set_delivery_check_state",
    "my_content_notices",
    "read_content_notice",
  ];
  await context.route("**/rest/v1/rpc/**", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    if (!names.includes(name)) return r.fallback();
    const b = r.request().postDataJSON() || {};
    if (name === "my_content_notices")
      return r.fulfill({ json: role === "parent" ? inbox : [] });
    if (name === "read_content_notice") {
      counts.reads++;
      const n = inbox.find((n) => n.id === b.notice_id);
      if (n) n.read_at ||= new Date().toISOString();
      return r.fulfill({ json: null });
    }
    if (name === "delivery_profile_workspace") return r.fulfill({ json: d });
    if (name === "delivery_staff_queue")
      return r.fulfill({
        json: d.checks
          .filter((c) => c.alert && c.alert.state !== "resolved")
          .map((c) => ({
            id: c.id,
            profile_id: athleteA,
            athlete_name: "Fictional Jordan",
            cycle_key: c.cycle_key,
            due_at: c.due_at,
            timezone: c.rule_snapshot.timezone,
            last_checked_at: c.last_checked_at,
            state: c.alert!.state,
            escalated_at: c.alert!.escalated_at,
            episode: 1,
            available_now: c.available_now,
          })),
      });
    if (name === "evaluate_delivery_checks") {
      counts.checks++;
      d.checks[0].available_now = true;
      d.checks[0].first_observed_available_at ||= new Date().toISOString();
      d.checks[0].alert!.state = "resolved";
      return r.fulfill({ json: null });
    }
    if (name === "save_delivery_override") {
      if (role !== "owner")
        return r.fulfill({ status: 403, json: { message: "Owner required" } });
      counts.saves++;
      d.athlete = { overrides: b.overrides, state: b.state, version: 1 };
      return r.fulfill({ json: null });
    }
    if (name === "acknowledge_delivery_alert") {
      d.checks[0].alert!.state = "acknowledged";
      return r.fulfill({ json: null });
    }
    return r.fulfill({ json: null });
  });
  return { d, inbox, counts };
}
test("Owner delivery settings and manual queue are explicit, scoped and refresh-safe", async ({
  page,
  context,
}, info) => {
  await staffFixture(context, staffState());
  const { counts, d } = await notifications(context);
  await page.goto("./?source=app#staff-delivery");
  const panel = page.getByRole("region", { name: "Delivery monitoring" });
  await expect(panel).toContainText("Manual checks only.");
  await expect(panel).toContainText("TEST weekly training");
  const overrides = panel.locator("details").filter({
    has: page.locator("summary", {
      hasText: "Athlete overrides · this athlete only",
    }),
  });
  await overrides.locator("summary").click();
  await overrides
    .getByLabel("Athlete service monitoring state")
    .selectOption("paused");
  await overrides
    .getByRole("button", { name: "Save athlete overrides" })
    .dblclick();
  await expect(panel.getByRole("status")).toContainText(
    "Athlete settings saved",
  );
  expect(counts.saves).toBe(1);
  expect(d.athlete?.state).toBe("paused");
  await panel
    .locator("summary", {
      hasText: "Missing-submission reminders · separate event",
    })
    .click();
  await expect(panel).toContainText(
    "A missing athlete upload is not the same as staff failing to deliver training",
  );
  await panel
    .getByLabel("Expected submission (draft)")
    .fill("One assigned practice clip");
  await panel.getByLabel("Draft reminder cadence (hours)").fill("48");
  await panel.getByRole("button", { name: "Save reminder draft" }).click();
  await expect(panel.getByRole("status")).toContainText(
    "reminders remain disabled",
  );
  expect(d.athlete?.overrides).toMatchObject({
    submission_expectation: "One assigned practice clip",
    submission_cadence_hours: 48,
    submission_reminders: false,
  });
  await mkdir("docs/delivery-preview", { recursive: true });
  await panel.screenshot({
    path: `docs/delivery-preview/settings-${info.project.name}.png`,
    style: ".app-header,.app-tabs{visibility:hidden !important}",
  });
  await overrides.locator("summary").click();
  await panel
    .getByRole("button", { name: "Check this athlete now" })
    .dblclick();
  await expect(panel.getByRole("status")).toContainText(
    "Manual check finished",
  );
  expect(counts.checks).toBe(1);
  await page.reload();
  await expect(panel).toContainText("No unresolved delivery alerts");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("Coach has no configuration authority; parent sees private read/unread inbox and no staff queue", async ({
  page,
  context,
  browser,
}, info) => {
  await staffFixture(context, staffState(), "coach", coachA);
  await notifications(context, "coach");
  await page.goto("./?source=app#staff-delivery");
  const panel = page.getByRole("region", { name: "Delivery monitoring" });
  await expect(panel).toContainText("Manual checks only");
  await expect(
    panel.locator("summary", { hasText: "Package delivery defaults" }),
  ).toHaveCount(0);
  const parentContext = await browser.newContext({
    viewport: page.viewportSize()!,
  });
  try {
    await fixture(parentContext, state(), "parent");
    const data = await notifications(parentContext, "parent");
    const parent = await parentContext.newPage();
    await parent.goto(new URL("./?source=app#workspace", page.url()).href);
    const inbox = parent.getByRole("region", {
      name: "Your content notifications",
    });
    await expect(inbox).toContainText("2 unread");
    await expect(
      parent.getByRole("region", { name: "Delivery monitoring" }),
    ).toHaveCount(0);
    await inbox
      .getByRole("button", { name: "Mark as read" })
      .first()
      .dblclick();
    await expect(inbox).toContainText("1 unread");
    expect(data.counts.reads).toBe(1);
    await parent.reload();
    await expect(inbox).toContainText("1 unread");
    await inbox.screenshot({
      path: `docs/delivery-preview/inbox-${info.project.name}.png`,
      style: ".app-header,.app-tabs{visibility:hidden !important}",
    });
    expect(
      await parent.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await parentContext.close();
  }
});
