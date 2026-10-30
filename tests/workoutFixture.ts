import { expect, type BrowserContext } from "@playwright/test";
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
    review_stage: "approved",
    review_notes: "",
  }));
  return {
    resources,
    profiles: [
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
    ],
    profileAssignments: new Map<string, Row>(),
    workouts: new Map<string, Row>(),
    assignment: null as Row | null,
    reports: [] as Row[],
    counts: { saves: 0, assigns: 0, reports: 0, removes: 0 },
    eligible: true,
    failSave: false,
    failAssign: false,
    resumes: new Map<string, Row>(),
    failResume: false,
    failReview: false,
  };
}
type State = ReturnType<typeof state>;
async function fixture(
  context: BrowserContext,
  backend: State,
  role = "owner",
  actorId?: string,
  seedOnce = false,
) {
  const id = actorId || (role === "parent" ? accountId : staffId);
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
    ({ session, once }) => {
      const marker = "repformed.test-session-seeded";
      if (once && sessionStorage.getItem(marker)) return;
      localStorage.setItem(
        "sb-separate-demo-auth-token",
        JSON.stringify(session),
      );
      if (once) sessionStorage.setItem(marker, "1");
    },
    {
      once: seedOnce,
      session: {
        access_token: token,
        refresh_token: "fictional-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user,
      },
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
    const body =
      request.headers()["content-type"]?.includes("application/json") &&
      request.postData()
        ? (request.postDataJSON() as Row)
        : {};
    const json = (v: unknown, status = 200) =>
      route.fulfill({ json: v, status });
    if (path.endsWith("/user")) return json(user);
    if (path.endsWith("/logout"))
      return route.fulfill({ status: 204, body: "" });
    if (path.endsWith("/account_roles")) return json([{ role, version: 1 }]);
    if (path.endsWith("/rpc/staff_training_resources"))
      return json(backend.resources);
    if (path.endsWith("/training_resources")) {
      const requested = url.searchParams.get("id")?.replace("eq.", "");
      if (method === "POST") {
        const row = {
          ...body,
          created_by: staffId,
          version: 1,
          status: "draft",
          review_stage: "draft",
          review_notes: "",
        };
        backend.resources.unshift(row as (typeof backend.resources)[number]);
        return json(row);
      }
      if (method === "PATCH") {
        const row = backend.resources.find((d) => d.id === requested);
        if (!row) return json(null);
        Object.assign(row, body, {
          version: row.version + 1,
          status: "draft",
          review_stage: "draft",
          review_notes: "",
        });
        return json(row);
      }
      return json(
        requested
          ? backend.resources.find((d) => d.id === requested) || null
          : backend.resources,
      );
    }
    if (path.endsWith("/rpc/review_training_resource")) {
      if (backend.failReview) {
        backend.failReview = false;
        return json({ message: "Fictional retryable review failure" }, 400);
      }
      const row = backend.resources.find((d) => d.id === body.resource);
      if (
        !row ||
        row.version !== body.expected_version ||
        (body.decision !== "submit" && !["owner", "manager"].includes(role))
      )
        return json(
          { message: "Fictional permission or review conflict" },
          400,
        );
      row.review_stage =
        body.decision === "approve"
          ? "approved"
          : body.decision === "submit"
            ? "pending"
            : "changes_requested";
      row.status = row.review_stage === "approved" ? "published" : "draft";
      row.review_notes = String(body.note || "");
      row.version++;
      return json(row);
    }
    const currentAssignment =
      backend.profileAssignments.get(String(body.target_profile)) ||
      backend.assignment;
    const resumeKey = `${id}:${body.target_profile}`;
    if (path.endsWith("/rpc/load_practice_resume"))
      return json(backend.resumes.get(resumeKey) || null);
    if (path.endsWith("/rpc/save_practice_resume")) {
      if (backend.failResume) {
        backend.failResume = false;
        return json({ message: "Fictional save interruption" }, 400);
      }
      const previous = backend.resumes.get(resumeKey);
      if (previous && previous.version !== body.expected_version)
        return json({ message: "Fictional device conflict" }, 400);
      const row = {
        profile_id: body.target_profile,
        session_id: body.session,
        resource_ids: body.resources,
        resource_versions: body.resource_versions,
        current_index: body.current_position,
        workout_id: body.expected_workout,
        workout_version: body.expected_workout_version,
        assignment_version: currentAssignment?.version || 0,
        permission_version: 0,
        version: Number(previous?.version || 0) + 1,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      backend.resumes.set(resumeKey, row);
      return json(row);
    }
    if (path.endsWith("/rpc/discard_practice_resume")) {
      const previous = backend.resumes.get(resumeKey);
      if (previous && previous.version !== body.expected_version)
        return json({ message: "Fictional device conflict" }, 400);
      backend.resumes.delete(resumeKey);
      return json({});
    }

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
      for (const [key, a] of backend.profileAssignments)
        if (a.workout_id === body.workout)
          backend.profileAssignments.set(key, {
            ...a,
            workout_id: null,
            resource_ids: [],
            version: Number(a.version) + 1,
          });
      return json({});
    }
    if (
      path.endsWith("/rpc/list_account_access") ||
      path.endsWith("/rpc/list_account_access_v2")
    )
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
    if (path.endsWith("/rpc/workout_assignment_profiles"))
      return json(
        backend.profiles.filter((p) => p.owner_id === body.target_account),
      );
    if (path.endsWith("/rpc/profile_workout_assignment"))
      return json(currentAssignment);
    if (path.endsWith("/member_workout_assignments"))
      return json(backend.assignment);
    if (
      path.endsWith("/rpc/workout_assignment_preview") ||
      path.endsWith("/rpc/profile_workout_preview")
    )
      return json({ eligible: backend.eligible });
    if (
      path.endsWith("/rpc/assign_training_workout") ||
      path.endsWith("/rpc/assign_profile_workout")
    ) {
      backend.counts.assigns++;
      if (backend.failAssign) {
        backend.failAssign = false;
        return json({ message: "Fictional assignment conflict" }, 400);
      }
      const w = backend.workouts.get(String(body.workout));
      const nextAssignment = {
        workout_id: w?.id || null,
        workout_title: w?.title || "",
        summary: w?.summary || "",
        resource_ids: w?.resource_ids || [],
        workout_version: w?.version || 0,
        version: Number(currentAssignment?.version || 0) + 1,
      };
      if (body.target_profile) {
        backend.profileAssignments.set(
          String(body.target_profile),
          nextAssignment,
        );
      } else backend.assignment = nextAssignment;
      return json(nextAssignment);
    }
    if (path.endsWith("/member_accounts"))
      return json({
        user_id: accountId,
        account_type: "parent",
        privacy_version: "pilot",
      });
    if (path.endsWith("/profile_settings"))
      return json({ under18_enabled: false });
    if (path.endsWith("/player_profiles")) return json(backend.profiles);
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
        workouts: backend.reports.filter(
          (r) => r.profile_id === body.target_profile,
        ),
        assigned_workout: currentAssignment?.workout_id
          ? {
              id: currentAssignment.workout_id,
              title: currentAssignment.workout_title,
              summary: currentAssignment.summary,
              resource_ids: currentAssignment.resource_ids,
              version: currentAssignment.workout_version,
              eligible: true,
            }
          : null,
      });
    if (path.endsWith("/rpc/athlete_training_plan"))
      return json(
        currentAssignment
          ? (currentAssignment.resource_ids as string[]).map((k) =>
              backend.resources.find((d) => d.id === k),
            )
          : [],
      );
    if (path.endsWith("/rpc/athlete_video_state"))
      return json({ can_submit: false, adult_only: false, reviews: [] });
    if (path.endsWith("/rpc/report_saved_workout")) {
      backend.counts.reports++;
      const ids = body.requested_drills as string[];
      expect(ids).toEqual(currentAssignment?.resource_ids);
      expect(body.expected_workout).toBe(currentAssignment?.workout_id);
      const row = {
        id: body.workout_id,
        profile_id: body.target_profile,
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
        workout_title: currentAssignment?.workout_title,
        training_workout_id: body.expected_workout,
        workout_version: body.expected_workout_version,
      };
      if (!backend.reports.some((report) => report.id === row.id))
        backend.reports.push(row);
      backend.resumes.delete(resumeKey);
      return json(row);
    }
    if (
      path.startsWith("/storage/v1/object/training-media/") &&
      method === "POST"
    )
      return json({ Key: path.split("/object/")[1] });
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

export { state, fixture, build, save, uid, staffId, accountId, profileId };
export type { Row, State };

/** Regression coverage for retained legacy assignment URLs. The primary UI is tested in athlete-assignment.spec.ts. */
export async function openAssignment(page: import("@playwright/test").Page) {
  if (await page.getByLabel("Assign to customer account").isVisible()) return;
  const id = await page
    .locator('.builder-workout-choice[aria-pressed="true"]')
    .getAttribute("data-workout-id");
  if (!id)
    throw Error(
      "Choose a saved workout before opening legacy assignment coverage",
    );
  await page.goto(`./?trainingWorkout=${id}#training-assign`);
  await expect(page.getByLabel("Assign to customer account")).toBeVisible();
}
export async function editCurrentWorkout(
  page: import("@playwright/test").Page,
) {
  await page
    .getByRole("link", { name: "Back to Training", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Edit workout", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Workout name")).toBeVisible();
}
