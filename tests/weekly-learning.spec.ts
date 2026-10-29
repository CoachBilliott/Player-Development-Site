import { test, expect } from "@playwright/test";
import { fixture, state, accountId, profileId } from "./workoutFixture";
import { staffFixture, staffState, athleteA } from "./staffServiceFixture";
import {
  learningSimulation,
  sampleProfiles,
  rosterProfiles,
} from "../preview/private/learningSimulation";
import { learningBridge } from "../preview/private/learningBridge";
import type { StaffAthlete } from "../src/staffService";
import { serviceRows, serviceState } from "../src/staffServiceView";
import type { BrowserContext } from "@playwright/test";
async function connect(context: BrowserContext, role: "owner" | "parent") {
  const sim = learningSimulation(role);
  const bridge = learningBridge(sim, role);
  const roster = staffState();
  const alias = new Map(
    roster.rows
      .filter((r) => r.athlete_id)
      .map((r, i) => [r.athlete_id!, rosterProfiles[i].id]),
  );
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        staffRosterEnabled: true,
        learningPlansEnabled: true,
      },
    }),
  );
  async function enriched() {
    const rows: StaffAthlete[] = [];
    for (const row of roster.rows) {
      if (!row.athlete_id) {
        rows.push(row);
        continue;
      }
      const value = await bridge.rpc("staff_athlete_service", {
        target_profile: alias.get(row.athlete_id),
      });
      if (value.error) continue;
      rows.push({
        ...row,
        learning: (value.data as unknown as StaffAthlete).learning,
        next_action: (value.data as unknown as StaffAthlete).next_action,
      });
    }
    return rows;
  }
  await context.route("**/rest/v1/rpc/staff_athlete_service", async (r) => {
    const body = r.request().postDataJSON();
    const rows = await enriched();
    const row = rows.find((row) => row.athlete_id === body.target_profile);
    return r.fulfill(
      row
        ? { json: row }
        : { status: 403, json: { message: "Outside service roster" } },
    );
  });
  await context.route(
    "**/rest/v1/rpc/staff_learning_roster_page",
    async (r) => {
      const body = r.request().postDataJSON();
      calls.push({ name: "staff_learning_roster_page", body });
      if (role === "parent")
        return r.fulfill({
          status: 403,
          json: { message: "Staff access required" },
        });
      const all = await enriched();
      const filtered = serviceRows(
        all,
        String(body.search_text || ""),
        String(body.status_filter || "all"),
      );
      return r.fulfill({
        json: {
          source: "account_backend",
          scope: "all_repformed_clients",
          rows: filtered,
          coaches: [],
          page: {
            total: all.length,
            matched: filtered.length,
            athletes: all.length,
            clients: 2,
            counts: {
              overdue: all.filter((r) => serviceState(r) === "overdue").length,
              attention: all.filter((r) => serviceState(r) === "attention")
                .length,
              ready: all.filter((r) => serviceState(r) === "ready").length,
            },
            ages: ["18+"],
            positions: ["Quarterback", "Defensive back"],
            next_cursor: null,
          },
        },
      });
    },
  );
  await context.route("**/rest/v1/rpc/learning_*", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").at(-1)!;
    const body = r.request().postDataJSON() as Record<string, unknown>;
    calls.push({ name, body });
    try {
      let data: unknown;
      if (name === "learning_catalog") data = await sim.api.catalog();
      else if (name === "learning_inbox") {
        data = (await sim.api.inbox()).map((n) => {
          const real = [...alias].find(([, id]) => id === n.profile_id)?.[0];
          return {
            ...n,
            profile_id: real || n.profile_id,
            athlete_name:
              roster.rows.find((row) => row.athlete_id === real)
                ?.athlete_name || n.athlete_name,
          };
        });
      } else if (name === "learning_athlete") {
        const d = await sim.api.athlete(
          alias.get(String(body.target_profile)) || sampleProfiles[0].id,
        );
        for (const e of d.enrollments)
          for (const rel of e.releases)
            for (const a of rel.attempts) a.actor_id = accountId;
        data = d;
      } else if (name === "learning_save_attempt")
        data = await sim.api.saveAttempt(
          String(body.target_attempt),
          String(body.target_release),
          String(body.target_quiz),
          body.responses as Record<string, string | number>,
          !!body.submit,
          Number(body.expected_version),
        );
      else if (name === "learning_import_quiz") {
        const result = await bridge.rpc(name, body);
        if (result.error) throw Error(result.error.message);
        data = result.data;
      } else throw Error("Unconnected synthetic endpoint: " + name);
      await r.fulfill({ json: data });
    } catch (e) {
      await r.fulfill({
        status: 403,
        json: { message: e instanceof Error ? e.message : "Denied" },
      });
    }
  });
  return calls;
}
test("enabled Owner plan opens inside selected athlete, preserves account context and can reach quiz import", async ({
  page,
  context,
}) => {
  await staffFixture(context, staffState(), "owner");
  const calls = await connect(context, "owner");
  await page.goto("./#workspace");
  await page
    .getByRole("button", { name: /Fictional Jordan/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Weekly plan", exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        calls.filter((c) => c.name === "learning_athlete").at(-1)?.body
          .target_profile,
    )
    .toBe(athleteA);
  await page.getByRole("button", { name: "Back to athletes" }).click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  await page.getByRole("button", { name: "Weekly plans & quizzes" }).click();
  await page.getByRole("button", { name: "Quiz uploads", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Upload a quiz", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Blank template" }),
  ).toHaveAttribute("href", "./templates/repformed-quiz-blank.csv");
});
test("enabled household training uses selected profile and server draft endpoint without posting a trusted grade", async ({
  page,
  context,
}) => {
  await fixture(context, state(), "parent");
  const calls = await connect(context, "parent");
  await page.goto("./#app-workouts");
  await expect(
    page.getByRole("heading", { name: "Your released library." }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        calls.filter((c) => c.name === "learning_athlete").at(-1)?.body
          .target_profile,
    )
    .toBe(profileId);
  await page.getByRole("button", { name: "Open week", exact: true }).click();
  await page.getByRole("button", { name: "Take quiz", exact: true }).click();
  await page.getByLabel("START", { exact: true }).check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  const saved = calls
    .filter((c) => c.name === "learning_save_attempt")
    .at(-1)!.body;
  expect(saved).toMatchObject({
    submit: false,
    expected_version: 0,
    responses: { sample_1: 0 },
  });
  expect(saved).not.toHaveProperty("objective_points");
  expect(saved).not.toHaveProperty("score");
  await expect(
    page.getByRole("button", { name: "Grade written answers" }),
  ).toHaveCount(0);
});
test("server-backed group choices settle and do not refetch on checkbox changes", async ({
  page,
  context,
}) => {
  await staffFixture(context, staffState(), "owner");
  const calls = await connect(context, "owner");
  await page.goto("./#workspace");
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  await page.getByRole("button", { name: "Weekly plans & quizzes" }).click();
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await page.getByText("Create or edit a group", { exact: true }).click();
  const picker = page.locator(".learning-roster-picker");
  const choices = picker.getByRole("checkbox");
  await expect(choices.first()).toBeVisible();
  const count = calls.filter(
    (c) => c.name === "staff_learning_roster_page",
  ).length;
  await choices.first().check();
  await expect(picker).toContainText("1 selected across all pages");
  await page
    .getByRole("button", { name: "Cancel group edits", exact: true })
    .click();
  await expect(picker).toContainText("0 selected across all pages");
  expect(
    calls.filter((c) => c.name === "staff_learning_roster_page").length,
  ).toBe(count);
});
test("weekly member navigation separates current week, library and recorded grades", async ({
  page,
  context,
}) => {
  await fixture(context, state(), "parent");
  await connect(context, "parent");
  await page.goto("./#workspace");
  await expect(
    page.getByRole("heading", { name: "This week’s plan", exact: true }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  await nav.getByRole("link", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Released library", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Progress & grades", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Learning progress" }),
  ).toContainText("No quiz attempts observed.");
  await expect(
    page.getByRole("link", { name: "Weekly plan help", exact: true }),
  ).toHaveAttribute("href", "/weekly-learning-help.html");
});

test("staff pairs each IQ lesson with a quiz and sees server missing-item status before approval", async ({
  page,
  context,
}) => {
  await staffFixture(context, staffState(), "owner");
  await connect(context, "owner");
  const catalog = learningSimulation("owner").export().catalog;
  const plan = catalog.plans[0];
  plan.package_ids = ["foundation"];
  plan.weeks_content = [];
  const second = {
    ...catalog.quizzes[0],
    id: "92000000-0000-4000-8000-000000000032",
    title: "Fictional second quiz",
  };
  catalog.quizzes.push(second);
  await context.route("**/rest/v1/rpc/learning_catalog", (r) =>
    r.fulfill({ json: catalog }),
  );
  const saves: Record<string, unknown>[] = [];
  await context.route(
    "**/rest/v1/rpc/learning_save_week_checked",
    async (r) => {
      const body = r.request().postDataJSON();
      saves.push(body);
      plan.weeks_content.push({
        id: body.target_id,
        week_number: 1,
        title: body.week_title,
        revision: 1,
        approved_at: null,
        ready: false,
        resources: [],
        quiz_version_ids: body.quizzes,
        readiness: {
          mode: "package",
          complete: false,
          ready: false,
          missing: [
            "All selected uploads must be complete, approved and unchanged.",
          ],
        },
      });
      await r.fulfill({ json: body.target_id });
    },
  );
  await page.goto("./#workspace");
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Weekly plans & quizzes", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Open plan", exact: true })
    .selectOption(plan.id);
  await page
    .getByLabel("Week title", { exact: true })
    .fill("Synthetic Foundation draft");
  for (let i = 1; i <= 2; i++) {
    await page
      .getByRole("checkbox", { name: `Fictional drill ${i}`, exact: true })
      .check();
    await page
      .getByRole("combobox", {
        name: `Fictional drill ${i}: content category`,
        exact: true,
      })
      .selectOption("iq");
    await page
      .getByRole("combobox", {
        name: `Fictional drill ${i}: lesson quiz`,
        exact: true,
      })
      .selectOption(catalog.quizzes[i - 1].id);
  }
  await page
    .getByRole("button", { name: "Save week draft", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Week version saved as a draft",
  );
  expect(saves).toHaveLength(1);
  expect(saves[0].quizzes).toEqual(catalog.quizzes.map((q) => q.id));
  expect(
    Object.values(saves[0].lesson_allocations as Record<string, unknown>),
  ).toEqual(
    catalog.quizzes.map((q) => ({ kind: "iq", quiz_version_id: q.id })),
  );
  await expect(
    page.getByRole("list", {
      name: "Synthetic Foundation draft missing items",
    }),
  ).toContainText(
    "All selected uploads must be complete, approved and unchanged.",
  );
  await expect(
    page.getByRole("button", { name: "Approve week", exact: true }),
  ).toBeDisabled();
  expect(saves[0]).not.toHaveProperty("ready");
  expect(saves[0]).not.toHaveProperty("approved_at");
});

test("staff cannot treat an older unchecked ready flag as package certification", async ({
  page,
  context,
}) => {
  await staffFixture(context, staffState(), "owner");
  await connect(context, "owner");
  const catalog = learningSimulation("owner").export().catalog;
  const plan = catalog.plans[0];
  plan.package_ids = ["foundation"];
  plan.weeks_content.forEach((w) => {
    delete w.readiness;
    w.approved_at = null;
    w.ready = true;
  });
  await context.route("**/rest/v1/rpc/learning_catalog", (r) =>
    r.fulfill({ json: catalog }),
  );
  await page.goto("./#workspace");
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Weekly plans & quizzes", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Open plan", exact: true })
    .selectOption(plan.id);
  await expect(
    page
      .getByText(
        "Package validation unavailable; ask the Owner to finish setup",
        { exact: false },
      )
      .first(),
  ).toBeVisible();
  for (const button of await page
    .getByRole("button", { name: "Approve week", exact: true })
    .all())
    await expect(button).toBeDisabled();
});
