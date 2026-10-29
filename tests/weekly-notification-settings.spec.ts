import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  staffFixture,
  staffState,
  coachA,
  athleteA,
  athleteB,
} from "./staffServiceFixture";
import { uid } from "./workoutFixture";
import { draftDeliveryRule } from "../src/deliveryRules";
import type {
  WeeklyNotificationWorkspace,
  WeeklyRulePatch,
} from "../src/learning/notificationRules";
const pkgA = uid(850),
  pkgB = uid(851);
async function weeklySettings(
  context: BrowserContext,
  role: "owner" | "manager" | "coach" = "owner",
) {
  await context.route("https://*.supabase.co/**", (r) => r.abort());
  await staffFixture(
    context,
    staffState(),
    role,
    role === "coach" ? coachA : undefined,
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
        deliveryMonitoringEnabled: true,
        learningPlansEnabled: true,
      },
    }),
  );
  const initial = (profile: string): WeeklyNotificationWorkspace => ({
    profile_id: profile,
    global: {
      friday_time: "17:00",
      reminders_enabled: true,
      low_ready_weeks: 2,
    },
    runtime: {
      learning_enabled: false,
      scheduler_enabled: false,
      notices_enabled: false,
    },
    packages: [
      {
        id: pkgA,
        title: "Fictional Foundation defaults",
        version: 1,
        rules: { friday_time: "18:00" },
      },
      {
        id: pkgB,
        title: "Fictional Elite defaults",
        version: 1,
        rules: { friday_time: "21:00", low_ready_weeks: 1 },
      },
    ],
    client: { package_id: pkgA, version: 1, rules: {} },
    athlete: null,
    effective: {
      friday_time: "18:00",
      reminders_enabled: true,
      low_ready_weeks: 2,
      timezone: "America/Chicago",
      staff_routing: "assigned_coach",
      training_notices: true,
    },
  });
  const settings = new Map<string, WeeklyNotificationWorkspace>();
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  const controls = {
    missing: false,
    denied: false,
    loseOnce: false,
    reads: 0,
    writes: 0,
  };
  function resolve(d: WeeklyNotificationWorkspace) {
    const p = d.packages.find(
      (p) => p.id === (d.athlete?.package_id || d.client?.package_id),
    );
    d.effective = {
      ...d.effective,
      ...d.global,
      ...p?.rules,
      ...d.client?.rules,
      ...d.athlete?.rules,
    };
  }
  await context.route("**/rest/v1/rpc/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const b = route.request().postDataJSON() || {};
    if (
      ![
        "learning_notification_workspace",
        "learning_save_notification_rule",
        "delivery_profile_workspace",
        "delivery_staff_queue",
        "staff_learning_roster_page",
      ].includes(name)
    )
      return route.fallback();
    calls.push({ name, body: b });
    if (name === "staff_learning_roster_page")
      return route.fulfill({
        status: 500,
        json: { message: "Settings must not use the daily paged roster." },
      });
    if (name === "delivery_staff_queue") return route.fulfill({ json: [] });
    if (name === "delivery_profile_workspace")
      return route.fulfill({
        json: {
          manual_only: true,
          email_adapter: "disabled",
          enabled: false,
          packages: [
            {
              id: pkgA,
              title: "Fictional Foundation defaults",
              rule: draftDeliveryRule,
              version: 1,
            },
            {
              id: pkgB,
              title: "Fictional Elite defaults",
              rule: draftDeliveryRule,
              version: 1,
            },
          ],
          client: {
            package_id: pkgA,
            overrides: {},
            version: 1,
            state: "active",
          },
          athlete: null,
          effective_rule: draftDeliveryRule,
          checks: [],
        },
      });
    if (name === "learning_notification_workspace") {
      controls.reads++;
      if (controls.missing)
        return route.fulfill({
          status: 404,
          json: { code: "PGRST202", message: "Function unavailable" },
        });
      if (controls.denied)
        return route.fulfill({
          status: 403,
          json: { code: "42501", message: "Owner access required" },
        });
      const id = String(b.target_profile);
      if (!settings.has(id)) settings.set(id, initial(id));
      resolve(settings.get(id)!);
      return route.fulfill({ json: settings.get(id) });
    }
    if (role !== "owner")
      return route.fulfill({
        status: 403,
        json: { code: "42501", message: "Owner access required" },
      });
    const profile = String(b.target_profile || athleteA);
    const d = settings.get(profile) || initial(profile);
    settings.set(profile, d);
    const patch = b.rule_patch as WeeklyRulePatch;
    const version = Number(b.expected_version);
    if (b.target_scope === "athlete") {
      if ((d.athlete?.version || 0) === version) {
        controls.writes++;
        d.athlete = {
          package_id: b.selected_weekly_package as string | null,
          rules: patch,
          version: version + 1,
        };
      } else if (
        d.athlete?.version !== version + 1 ||
        JSON.stringify(d.athlete.rules) !== JSON.stringify(patch)
      )
        return route.fulfill({
          status: 409,
          json: { message: "Athlete settings changed. Refresh before saving." },
        });
    } else if (b.target_scope === "client") {
      controls.writes++;
      d.client = { ...d.client!, rules: patch, version: version + 1 };
    } else {
      controls.writes++;
      const p = d.packages.find((p) => p.id === b.target_package)!;
      p.rules = patch;
      p.version = version + 1;
    }
    resolve(d);
    if (controls.loseOnce) {
      controls.loseOnce = false;
      return route.abort("failed");
    }
    return route.fulfill({ json: null });
  });
  return { calls, controls, settings };
}
async function open(page: import("@playwright/test").Page) {
  await page.goto("./#staff-delivery");
  await page
    .getByText("Weekly notification preferences", { exact: true })
    .click();
  await expect(page.getByLabel("Change preferences for")).toBeVisible();
}
test("Owner configures exact athlete, inherits independent package and saves once without activating notices", async ({
  context,
  page,
}) => {
  const { calls, controls, settings } = await weeklySettings(context);
  await open(page);
  await expect(
    page.getByText("Automatic notices are off.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByLabel("Notification package").selectOption(pkgB);
  await page.getByLabel("Set Friday time", { exact: true }).check();
  await page.getByLabel("Friday time (Central)", { exact: true }).fill("20:00");
  await page
    .getByRole("button", { name: "Save weekly preferences", exact: true })
    .dblclick();
  await expect(
    page.getByRole("status").filter({ hasText: "Weekly preferences saved." }),
  ).toBeVisible();
  expect(controls.writes).toBe(1);
  expect(settings.get(athleteA)?.athlete).toMatchObject({
    package_id: pkgB,
    rules: { friday_time: "20:00" },
  });
  expect(
    calls.filter((c) => c.name === "learning_save_notification_rule")[0].body,
  ).toEqual({
    target_scope: "athlete",
    target_profile: athleteA,
    target_package: null,
    rule_patch: { friday_time: "20:00" },
    expected_version: 0,
    selected_weekly_package: pkgB,
  });
  expect(calls.some((c) => c.name === "staff_learning_roster_page")).toBe(
    false,
  );
  await expect(page.locator(".weekly-effective")).toContainText("20:00");
  await page
    .getByRole("combobox", { name: "Athlete delivery settings", exact: true })
    .selectOption(athleteB);
  await page
    .getByText("Weekly notification preferences", { exact: true })
    .click();
  await expect(page.locator(".weekly-effective")).toContainText("18:00");
  expect(settings.get(athleteB)?.athlete).toBeNull();
});
test("scope switching confirms discard, cancel is a no-op and inherited values are visible", async ({
  context,
  page,
}) => {
  const { controls } = await weeklySettings(context);
  await open(page);
  await page.getByLabel("Set ready-week threshold", { exact: true }).check();
  await page.getByLabel("Warn below (ready weeks)").fill("4");
  await page.getByLabel("Change preferences for").selectOption("client");
  await expect(
    page.getByRole("region", { name: "Unsaved weekly preferences" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Change preferences for")).toBeFocused();
  await expect(page.getByLabel("Warn below (ready weeks)")).toHaveValue("4");
  await page.getByRole("button", { name: "Cancel draft changes" }).click();
  await expect(page.getByLabel("Warn below (ready weeks)")).toBeDisabled();
  await page
    .getByLabel("Change preferences for")
    .selectOption(`package:${pkgA}`);
  await expect(
    page.getByRole("group", { name: "Package defaults", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Friday time (Central)", { exact: true }),
  ).toHaveValue("18:00");
  expect(controls.writes).toBe(0);
});
test("lost save response retains draft and retries the same version without duplicate mutation", async ({
  context,
  page,
}) => {
  const { controls, calls } = await weeklySettings(context);
  await open(page);
  controls.loseOnce = true;
  await page.getByLabel("Set reminder preference", { exact: true }).check();
  await page
    .getByRole("combobox", {
      name: "Friday reminder (in-app)",
      exact: true,
    })
    .selectOption("false");
  await page
    .getByRole("button", { name: "Save weekly preferences", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Your draft has been kept." }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", {
      name: "Friday reminder (in-app)",
      exact: true,
    }),
  ).toHaveValue("false");
  await page
    .getByRole("button", { name: "Save weekly preferences", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Weekly preferences saved." }),
  ).toBeVisible();
  expect(controls.writes).toBe(1);
  expect(
    calls
      .filter((c) => c.name === "learning_save_notification_rule")
      .map((c) => c.body.expected_version),
  ).toEqual([0, 0]);
});
test("missing capability and permission failure are distinct, retryable and never pretend save success", async ({
  context,
  page,
}) => {
  const { controls } = await weeklySettings(context);
  controls.missing = true;
  await page.goto("./#staff-delivery");
  await page
    .getByText("Weekly notification preferences", { exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "reviewed migration024" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save weekly preferences", exact: true }),
  ).toHaveCount(0);
  controls.missing = false;
  controls.denied = true;
  await page.reload();
  await page
    .getByText("Weekly notification preferences", { exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be loaded" }),
  ).toBeVisible();
  controls.denied = false;
  await page.getByRole("button", { name: "Retry weekly settings" }).click();
  await expect(page.getByLabel("Change preferences for")).toBeVisible();
  expect(controls.writes).toBe(0);
});
for (const role of ["manager", "coach"] as const)
  test(`${role} has no weekly configuration controls or new private preference reads`, async ({
    context,
    page,
  }) => {
    const { controls } = await weeklySettings(context, role);
    await page.goto("./#staff-delivery");
    await expect(
      page.getByRole("heading", { name: "Keep delivery on track." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Delivery & notifications" }),
    ).toBeVisible();
    await expect(
      page.getByText("Weekly notification preferences", { exact: true }),
    ).toHaveCount(0);
    expect(controls.reads).toBe(0);
    expect(controls.writes).toBe(0);
  });
test("Owner preference form fits narrow phones, keeps keyboard focus and passes sampled accessibility", async ({
  context,
  page,
}, info) => {
  await weeklySettings(context);
  await page.setViewportSize({ width: 320, height: 900 });
  await open(page);
  const control = page.getByLabel("Change preferences for");
  await control.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Notification package")).toBeFocused();
  const scope = page.locator(".weekly-notification-settings");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".weekly-notification-settings")
        .analyze()
    ).violations,
  ).toEqual([]);
  const screenshot = info.outputPath("weekly-notification-owner-320.png");
  await page.evaluate(() => {
    const box = document
      .querySelector(".weekly-notification-settings")!
      .getBoundingClientRect();
    window.scrollTo(0, window.scrollY + box.top - 180);
  });
  await page.screenshot({ path: screenshot });
  await info.attach("Owner weekly preferences · fictional fixture", {
    path: screenshot,
    contentType: "image/png",
  });
});
