import { test, expect } from "@playwright/test";
import { fixture, state, accountId, profileId } from "./workoutFixture";
import { staffFixture, staffState, athleteA } from "./staffServiceFixture";
import {
  learningSimulation,
  sampleProfiles,
} from "../preview/private/learningSimulation";
import type { BrowserContext } from "@playwright/test";
async function connect(context: BrowserContext, role: "owner" | "parent") {
  const sim = learningSimulation(role);
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
  await context.route("**/rest/v1/rpc/learning_*", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").at(-1)!;
    const body = r.request().postDataJSON() as Record<string, unknown>;
    calls.push({ name, body });
    try {
      let data: unknown;
      if (name === "learning_catalog") data = await sim.api.catalog();
      else if (name === "learning_inbox") data = await sim.api.inbox();
      else if (name === "learning_athlete") {
        const d = await sim.api.athlete(sampleProfiles[0].id);
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
      else if (name === "learning_import_quiz") data = "simulated-save";
      else throw Error("Unconnected synthetic endpoint: " + name);
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
  expect(
    calls.filter((c) => c.name === "learning_athlete").at(-1)?.body
      .target_profile,
  ).toBe(athleteA);
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
  expect(
    calls.filter((c) => c.name === "learning_athlete").at(-1)?.body
      .target_profile,
  ).toBe(profileId);
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
