import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const uid = (n: number) =>
  `91000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const staffId = uid(1),
  accountId = uid(2),
  profileId = uid(3);
type Row = Record<string, unknown>;
function state() {
  const resources = Array.from({ length: 5 }, (_, n) => ({
    id: uid(10 + n),
    created_by: staffId,
    content: {
      sport: "football",
      title: `Fictional drill ${n + 1}`,
      skill: n === 0 ? "Coordination" : "Footwork",
      ages: [n === 4 ? "5–7" : "18+"],
      positions: [],
      levels: ["New to the game"],
      minutes: 3,
      equipment: `Paper marker ${n + 1}`,
      lesson: `Original fictional purpose ${n + 1}.`,
      steps: [`Walk to marker ${n + 1}.`],
      cue: "Keep steps controlled.",
      kind: "movement",
    },
    asset_path: `${staffId}/${uid(10 + n)}/${uid(10 + n)}.txt`,
    asset_type: "text/plain",
    asset_name: "original.txt",
    version: 1,
    status: "published",
    visibility: "member_only",
  }));
  return {
    resources,
    workouts: new Map<string, Row>(),
    assignment: null as Row | null,
    reports: [] as Row[],
    counts: { saves: 0, assigns: 0, reports: 0, removes: 0 },
    eligible: true,
    failSave: false,
    failAssign: false,
  };
}
type State = ReturnType<typeof state>;
async function fixture(
  context: BrowserContext,
  backend: State,
  role = "owner",
) {
  const id = role === "parent" ? accountId : staffId;
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email:
      role === "parent"
        ? "fictional-parent@example.test"
        : "fictional-staff@example.test",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fictional-signature`;
  await context.addInitScript(
    (session) =>
      localStorage.setItem(
        "sb-separate-demo-auth-token",
        JSON.stringify(session),
      ),
    {
      access_token: token,
      refresh_token: "fictional-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: "bearer",
      user,
    },
  );
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
      },
    }),
  );
  await context.route("https://separate-demo.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method();
    const body = request.postData() ? (request.postDataJSON() as Row) : {};
    const json = (v: unknown, status = 200) =>
      route.fulfill({ json: v, status });
    if (path.endsWith("/user")) return json(user);
    if (path.endsWith("/logout"))
      return route.fulfill({ status: 204, body: "" });
    if (path.endsWith("/account_roles")) return json([{ role, version: 1 }]);
    if (path.endsWith("/training_resources")) return json(backend.resources);
    if (path.endsWith("/training_workouts"))
      return json([...backend.workouts.values()]);
    if (path.endsWith("/rpc/save_training_workout")) {
      backend.counts.saves++;
      const previous = backend.workouts.get(String(body.workout));
      const next = {
        id: body.workout,
        title: body.title,
        summary: body.summary,
        resource_ids: body.resources,
        created_by: staffId,
        version:
          previous && Number(body.expected_version) === Number(previous.version)
            ? Number(previous.version) + 1
            : previous?.version || 1,
        updated_at: new Date().toISOString(),
      };
      backend.workouts.set(String(body.workout), next);
      if (backend.failSave) {
        backend.failSave = false;
        return json({ message: "Fictional lost save response" }, 400);
      }
      return json(next);
    }
    if (path.endsWith("/rpc/remove_training_workout")) {
      backend.counts.removes++;
      backend.workouts.delete(String(body.workout));
      backend.assignment = null;
      return json({});
    }
    if (path.endsWith("/rpc/list_account_access"))
      return json([
        {
          user_id: accountId,
          email: "fictional-parent@example.test",
          role: "parent",
          version: 1,
          email_verified: true,
          adult_setup: true,
        },
      ]);
    if (path.endsWith("/member_workout_assignments"))
      return json(backend.assignment);
    if (path.endsWith("/rpc/workout_assignment_preview"))
      return json({ eligible: backend.eligible });
    if (path.endsWith("/rpc/assign_training_workout")) {
      backend.counts.assigns++;
      if (backend.failAssign) {
        backend.failAssign = false;
        return json({ message: "Fictional assignment conflict" }, 400);
      }
      const w = backend.workouts.get(String(body.workout));
      backend.assignment = {
        workout_id: w?.id || null,
        workout_title: w?.title || "",
        summary: w?.summary || "",
        resource_ids: w?.resource_ids || [],
        workout_version: w?.version || 0,
        version: Number(backend.assignment?.version || 0) + 1,
      };
      return json(backend.assignment);
    }
    if (path.endsWith("/member_accounts"))
      return json({
        user_id: accountId,
        account_type: "parent",
        privacy_version: "pilot",
      });
    if (path.endsWith("/profile_settings"))
      return json({ under18_enabled: false });
    if (path.endsWith("/player_profiles"))
      return json([
        {
          id: profileId,
          owner_id: accountId,
          nickname: "Fictional Pilot",
          age_group: "18+",
          sport: "football",
          position: "Quarterback",
          experience: "New to the game",
          goal: "Footwork",
          guardian_confirmed: false,
          version: 1,
        },
      ]);
    if (path.endsWith("/rpc/athlete_account_context"))
      return json({ guardian_managed: false, linked_profile_id: null });
    if (path.endsWith("/rpc/family_profile_state"))
      return json({
        guardian_managed: false,
        is_family: true,
        is_parent: true,
        can_record: true,
        self_recording_allowed: false,
        permission_version: 0,
        has_link: false,
        child_access_ready: false,
        workouts: backend.reports,
        assigned_workout: backend.assignment?.workout_id
          ? {
              id: backend.assignment.workout_id,
              title: backend.assignment.workout_title,
              summary: backend.assignment.summary,
              resource_ids: backend.assignment.resource_ids,
              version: backend.assignment.workout_version,
              eligible: true,
            }
          : null,
      });
    if (path.endsWith("/rpc/athlete_training_plan"))
      return json(
        backend.assignment
          ? (backend.assignment.resource_ids as string[]).map((k) =>
              backend.resources.find((d) => d.id === k),
            )
          : [],
      );
    if (path.endsWith("/rpc/athlete_video_state"))
      return json({ can_submit: false, adult_only: false, reviews: [] });
    if (path.endsWith("/rpc/report_saved_workout")) {
      backend.counts.reports++;
      const ids = body.requested_drills as string[];
      expect(ids).toEqual(backend.assignment?.resource_ids);
      expect(body.expected_workout).toBe(backend.assignment?.workout_id);
      const row = {
        id: body.workout_id,
        profile_id: profileId,
        reported_by: accountId,
        drill_ids: ids,
        titles: ids.map(
          (k) => backend.resources.find((d) => d.id === k)!.content.title,
        ),
        minutes: ids.length * 3,
        status: "approved",
        created_at: new Date().toISOString(),
        reviewed_by: accountId,
        reviewed_at: new Date().toISOString(),
        version: 1,
        workout_title: backend.assignment?.workout_title,
        training_workout_id: body.expected_workout,
        workout_version: body.expected_workout_version,
      };
      backend.reports.push(row);
      return json(row);
    }
    if (path.includes("/storage/v1/object/sign/"))
      return method === "POST"
        ? json({
            signedURL:
              "/object/sign/training-media/original.txt?token=fictional",
          })
        : route.fulfill({
            contentType: "text/plain",
            body: "Original fictional reference.",
          });
    return json({ message: `Unexpected fixture path ${path}` }, 500);
  });
}
async function build(page: import("@playwright/test").Page, count = 4) {
  await page.goto("./?source=app#workout-builder");
  await page.getByLabel("Workout name").fill("Fictional complete practice");
  await page
    .getByLabel("Workout introduction")
    .fill("An original fictional adult practice sequence.");
  for (let n = 1; n <= count; n++)
    await page
      .getByRole("button", { name: `Add Fictional drill ${n} to workout` })
      .click();
}
async function save(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Preview workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(
    page.getByText(
      "Workout saved. An Owner can now assign this complete session.",
      { exact: true },
    ),
  ).toBeVisible();
}

test("staff composes, reorders, previews and saves a protected workout; Owner assigns the whole session and the athlete records it once", async ({
  page,
  context,
  browser,
}, info) => {
  const backend = state();
  await fixture(context, backend);
  await build(page);
  await page.getByRole("button", { name: "Move Fictional drill 4 up" }).click();
  const expected = [uid(10), uid(11), uid(13), uid(12)];
  await expect(
    page
      .getByRole("list", { name: "Selected drill order" })
      .getByRole("listitem"),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Preview workout", exact: true })
    .click();
  const preview = page.getByRole("dialog");
  await expect(
    preview
      .getByRole("list", { name: "Preview workout order" })
      .getByRole("listitem"),
  ).toHaveCount(4);
  await expect(
    preview.getByText("Walk to marker 1.", { exact: true }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Next preview drill" }).click();
  await expect(
    preview.getByText("Walk to marker 2.", { exact: true }),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: "Back to workout editing" })
    .click();
  expect(backend.workouts.size).toBe(0);
  await save(page);
  expect([...backend.workouts.values()][0].resource_ids).toEqual(expected);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page.getByRole("button", { name: "Keep current assignment" }).click();
  expect(backend.counts.assigns).toBe(0);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .dblclick();
  await expect(
    page.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(backend.counts.assigns).toBe(1);
  await page.screenshot({
    path: `artifacts/workout-builder-${info.project.name}.png`,
    fullPage: true,
  });
  const parentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await fixture(parentContext, backend, "parent");
  const athlete = await parentContext.newPage();
  await athlete.goto(new URL("./?source=app#workspace", page.url()).href);
  await expect(
    athlete.getByRole("heading", {
      name: "Fictional complete practice",
      exact: true,
    }),
  ).toBeVisible();
  await athlete
    .getByRole("button", { name: "Guide and record practice" })
    .click();
  const session = athlete.getByRole("dialog");
  await expect(
    session.getByRole("list", { name: "Workout order" }).getByRole("listitem"),
  ).toHaveCount(4);
  await session.getByRole("checkbox").check();
  await session.getByRole("button", { name: "Begin workout" }).click();
  for (const [n, key] of expected.entries()) {
    await expect(
      session.getByRole("heading", {
        name: backend.resources.find((d) => d.id === key)!.content.title,
        exact: true,
      }),
    ).toBeVisible();
    if (n) await athlete.waitForTimeout(700);
    await session
      .getByRole("button", {
        name: n === 3 ? "Finish workout" : "Complete drill · Next",
        exact: true,
      })
      .click();
  }
  await expect(session).toHaveCount(0);
  expect(backend.counts.reports).toBe(1);
  await athlete.goto(new URL("./?source=app#app-progress", athlete.url()).href);
  await expect(
    athlete.getByRole("heading", {
      name: "Fictional complete practice",
      exact: true,
    }),
  ).toBeVisible();
  await athlete.reload();
  await expect(
    athlete.getByRole("heading", {
      name: "Fictional complete practice",
      exact: true,
    }),
  ).toBeVisible();
  await parentContext.close();
});
test("incompatible drills block preview and never publish a workout", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 1);
  await page
    .getByRole("button", { name: "Add Fictional drill 5 to workout" })
    .click();
  await page
    .getByRole("button", { name: "Preview workout", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("do not share");
  expect(backend.counts.saves).toBe(0);
  await page
    .getByRole("button", { name: "Remove Fictional drill 5 from workout" })
    .click();
  await save(page);
});
test("saved workouts survive refresh; lost save responses retry the same ID and unsaved edits can be kept", async ({
  page,
  context,
}) => {
  const backend = state();
  backend.failSave = true;
  await fixture(context, backend);
  await build(page, 2);
  await page
    .getByRole("button", { name: "Preview workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not confirmed",
  );
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(
    page.getByText(
      "Workout saved. An Owner can now assign this complete session.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(backend.workouts.size).toBe(1);
  await page.reload();
  await page
    .getByRole("button", { name: /Fictional complete practice.*version 1/ })
    .click();
  await expect(page.getByLabel("Workout name")).toHaveValue(
    "Fictional complete practice",
  );
  await page.getByLabel("Workout name").fill("Unsaved revision");
  await page.getByRole("button", { name: "New workout", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing workout" }).click();
  await expect(page.getByLabel("Workout name")).toHaveValue("Unsaved revision");
});
test("ineligible and conflicting assignments keep existing access unchanged", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 2);
  await save(page);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  backend.eligible = false;
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await expect(
    page
      .getByRole("region", { name: "Assign complete workout" })
      .getByRole("alert"),
  ).toContainText("No eligible athlete");
  expect(backend.counts.assigns).toBe(0);
  backend.eligible = true;
  await page.getByRole("button", { name: "Preview assignment" }).click();
  backend.failAssign = true;
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not confirmed",
  );
  await page.getByRole("button", { name: "Keep current assignment" }).click();
  expect(backend.assignment).toBeNull();
});
test("removing a template or current assignment requires confirmation", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 2);
  await save(page);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(
    page.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove current assignment" }).click();
  await page.getByRole("button", { name: "Keep current assignment" }).click();
  expect(backend.assignment?.workout_id).toBeTruthy();
  await page.getByRole("button", { name: "Remove current assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm removal of assignment" })
    .click();
  await expect(
    page.getByText(
      "Workout assignment removed. Existing history and separate access are unchanged.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove saved workout" }).click();
  await page.getByRole("button", { name: "Keep saved workout" }).click();
  expect(backend.counts.removes).toBe(0);
  await page.getByRole("button", { name: "Remove saved workout" }).click();
  await page.getByRole("button", { name: "Yes, remove workout" }).click();
  await expect(
    page.getByText("Workout removed. Existing practice history is unchanged.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(backend.workouts.size).toBe(0);
});
test("coach can build own workouts without an account directory or assignment controls", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend, "coach");
  await build(page, 2);
  await save(page);
  await expect(
    page.getByRole("region", { name: "Assign complete workout" }),
  ).toHaveCount(0);
});
test("workout builder fits small phones and has no detected WCAG A/AA violations", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 4);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
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

test("editing a template does not silently replace an account assignment and unsaved changes cannot be assigned", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await build(page, 2);
  await save(page);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(
    page.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Workout name").fill("Revised complete practice");
  await expect(page.getByLabel("Assign to customer account")).toBeDisabled();
  await save(page);
  expect(backend.assignment?.workout_title).toBe("Fictional complete practice");
  expect(backend.counts.assigns).toBe(1);
  await page.getByLabel("Assign to customer account").selectOption(accountId);
  await expect(
    page.getByRole("region", { name: "Assign complete workout" }),
  ).toContainText("Current workout: Fictional complete practice");
  await page.getByRole("button", { name: "Preview assignment" }).click();
  await expect(page.getByRole("dialog")).toContainText("version 2");
  await page
    .getByRole("button", { name: "Confirm workout assignment" })
    .click();
  await expect(
    page.getByText(
      "Complete workout assigned. The athlete can refresh training to begin.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(backend.assignment?.workout_title).toBe("Revised complete practice");
});
