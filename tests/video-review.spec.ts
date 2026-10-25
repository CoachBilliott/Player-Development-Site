import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const id = (n: number) =>
  `80000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const userId = id(1),
  playerId = id(2),
  drillId = id(3),
  coachId = id(4);
const file = new URL("./fixtures/fictional-video.webm", import.meta.url)
  .pathname;
const media = readFileSync(file);
const content = {
  sport: "football",
  title: "Fictional assigned footwork",
  skill: "Footwork",
  ages: ["18+"],
  positions: [],
  levels: ["New to the game"],
  minutes: 3,
  equipment: "Clear flat space",
  lesson: "Practice controlled steps.",
  steps: ["Set two markers.", "Walk between the markers."],
  cue: "Keep steps controlled.",
  kind: "movement",
};
const resource = {
  id: drillId,
  content,
  asset_path: `${coachId}/${drillId}/${drillId}.webm`,
  asset_type: "video/webm",
  asset_name: "fixture.webm",
  version: 1,
  status: "published",
  visibility: "member_only",
};
type Review = {
  id: string;
  profile_id: string;
  account_id: string;
  submitted_by: string;
  resource_id: string;
  drill_title: string;
  asset_path: string;
  media_type: string;
  byte_size: number;
  duration_seconds: number;
  status: string;
  feedback: string;
  created_at: string;
  version: number;
};
async function fixture(
  context: BrowserContext,
  role = "athlete",
  failFirstUpload = false,
  drillCount = 1,
) {
  const rows: Review[] = [];
  const counts = {
    uploads: 0,
    finishes: 0,
    feedback: 0,
    deletes: 0,
    access: 0,
    reports: 0,
  };
  let uploaded = false;
  const workouts: Record<string, unknown>[] = [];
  const resources = Array.from({ length: drillCount }, (_, n) =>
    n === 0
      ? resource
      : {
          ...resource,
          id: id(100 + n),
          content: {
            ...content,
            title: `Fictional next drill ${n + 1}`,
            steps: [`Read marker ${n + 1}.`],
            equipment: `Paper marker ${n + 1}`,
          },
          asset_path: `${coachId}/${id(100 + n)}/${id(100 + n)}.webm`,
        },
  );
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "fictional-athlete@example.test",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const session = {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fictional-signature`,
    refresh_token: "fictional-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  await context.addInitScript(
    (session) =>
      localStorage.setItem(
        "sb-separate-demo-auth-token",
        JSON.stringify(session),
      ),
    session,
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
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname,
      body = (p.includes("/rpc/") ? req.postDataJSON() : {}) as Record<
        string,
        unknown
      >;
    const json = (v: unknown, status = 200) =>
      route.fulfill({ status, json: v });
    if (p.endsWith("/user")) return json(user);
    if (p.endsWith("/account_roles")) return json([{ role, version: 1 }]);
    if (p.endsWith("/member_accounts"))
      return json({
        user_id: userId,
        account_type: "adult",
        privacy_version: "pilot",
      });
    if (p.endsWith("/profile_settings"))
      return json({ under18_enabled: false });
    if (p.endsWith("/player_profiles"))
      return json([
        {
          id: playerId,
          owner_id: userId,
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
    if (p.endsWith("/rpc/athlete_account_context"))
      return json({ guardian_managed: false, linked_profile_id: null });
    if (
      p.endsWith("/rpc/athlete_training_plan") ||
      p.endsWith("/training_resources")
    )
      return json(resources);
    if (p.endsWith("/rpc/family_profile_state"))
      return json({
        guardian_managed: false,
        is_family: false,
        is_parent: false,
        can_record: true,
        self_recording_allowed: false,
        permission_version: 0,
        has_link: false,
        child_access_ready: true,
        workouts,
      });
    if (p.endsWith("/rpc/athlete_video_state"))
      return json({ can_submit: true, adult_only: false, reviews: rows });
    if (p.endsWith("/rpc/report_athlete_workout")) {
      counts.reports++;
      const w = {
        id: body.workout_id,
        profile_id: playerId,
        reported_by: userId,
        drill_ids: [drillId],
        titles: [content.title],
        minutes: 3,
        status: "self_reported",
        created_at: new Date().toISOString(),
        reviewed_by: null,
        reviewed_at: null,
        version: 1,
      };
      workouts.push(w);
      return json(w);
    }
    if (p.endsWith("/rpc/begin_athlete_video")) {
      let row = rows.find((v) => v.id === body.review_id);
      if (!row) {
        row = {
          id: String(body.review_id),
          profile_id: playerId,
          account_id: userId,
          submitted_by: userId,
          resource_id: drillId,
          drill_title: content.title,
          asset_path: `${userId}/${playerId}/${body.review_id}.webm`,
          media_type: "video/webm",
          byte_size: Number(body.byte_size),
          duration_seconds: Number(body.duration_seconds),
          status: "uploading",
          feedback: "",
          created_at: new Date().toISOString(),
          version: 1,
        };
        rows.push(row);
      }
      return json(row);
    }
    if (
      p.includes("/storage/v1/object/athlete-review-videos/") &&
      req.method() === "POST"
    ) {
      counts.uploads++;
      if (failFirstUpload && counts.uploads === 1)
        return json({ message: "Simulated failed upload" }, 400);
      uploaded = true;
      return json({ Key: p, Id: "fixture-upload" });
    }
    if (p.endsWith("/rpc/finish_athlete_video")) {
      counts.finishes++;
      if (!uploaded) return json({ message: "Upload incomplete" }, 400);
      const row = rows.find((v) => v.id === body.review_id)!;
      row.status = "queued";
      row.version = 2;
      return json(row);
    }
    if (p.endsWith("/athlete_video_reviews")) {
      const wanted = url.searchParams.get("id")?.replace("eq.", "");
      return json(
        wanted
          ? rows.find((v) => v.id === wanted) || null
          : rows.filter((v) => ["queued", "reviewed"].includes(v.status)),
      );
    }
    if (
      p.endsWith("/storage/v1/object/athlete-review-videos") &&
      req.method() === "DELETE"
    ) {
      counts.deletes++;
      return json([]);
    }
    if (p.endsWith("/rpc/delete_athlete_video")) {
      const i = rows.findIndex((v) => v.id === body.review_id);
      if (i >= 0) rows.splice(i, 1);
      return json({});
    }
    if (p.endsWith("/rpc/save_athlete_video_feedback")) {
      counts.feedback++;
      const row = rows.find((v) => v.id === body.review_id)!;
      row.feedback = String(body.feedback_text);
      row.status = "reviewed";
      row.version++;
      return json({});
    }
    if (p.includes("/storage/v1/object/sign/") && req.method() === "POST")
      return json({
        signedURL:
          "/object/sign/athlete-review-videos/fixture.webm?token=fictional",
      });
    if (p.includes("/storage/v1/object/sign/") && req.method() === "GET")
      return route.fulfill({ contentType: "video/webm", body: media });
    if (p.endsWith("/rpc/list_account_access"))
      return json([
        {
          user_id: userId,
          email: user.email,
          role,
          version: 1,
          email_verified: true,
          adult_setup: true,
        },
        {
          user_id: coachId,
          email: "fictional-coach@example.test",
          role: "coach",
          version: 1,
          email_verified: true,
          adult_setup: true,
        },
      ]);
    if (p.endsWith("/member_training_access")) return json(null);
    if (p.endsWith("/rpc/set_member_training_access")) {
      counts.access++;
      return json({
        resource_ids: body.resources,
        video_review_enabled: body.video_enabled,
        review_coach_id: body.coach,
        version: 1,
      });
    }
    return json({ message: `Unexpected fixture path: ${p}` }, 500);
  });
  return { rows, counts };
}
test("real drill viewer shows media and all steps together and records one completion", async ({
  page,
  context,
}) => {
  const backend = await fixture(context);
  await page.goto("./?source=app#workspace");
  await expect(page.locator('a[href="#demo"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Begin workout" }).click();
  await expect(d.getByText("Set two markers.")).toBeVisible();
  await expect(d.locator("video")).toBeVisible();
  await expect(
    d.getByRole("button", { name: "Show workout steps" }),
  ).toHaveCount(0);
  await d.getByRole("button", { name: "Finish workout" }).dblclick();
  await expect(d).toHaveCount(0);
  expect(backend.counts.reports).toBe(1);
});
test("recording can be canceled and unsupported files never upload", async ({
  page,
  context,
}) => {
  const backend = await fixture(context);
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Send a drill video" }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Record drill video")).toHaveAttribute(
    "capture",
    "environment",
  );
  await d.getByLabel("Choose drill video").setInputFiles({
    name: "bad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a video"),
  });
  await expect(d.getByRole("alert")).toContainText("MP4, MOV or WebM");
  await d.getByLabel("Choose drill video").setInputFiles([]);
  await d.getByRole("button", { name: "Cancel video", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(backend.counts.uploads).toBe(0);
  expect(backend.rows).toHaveLength(0);
});
test("video preview, repeated send clicks and refresh preserve exactly one private submission", async ({
  page,
  context,
}, info) => {
  const backend = await fixture(context);
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Send a drill video" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Choose drill video").setInputFiles(file);
  await expect(d.getByLabel("Your video preview")).toBeVisible();
  await page.screenshot({
    path: `artifacts/video-preview-${info.project.name}.png`,
  });
  await d
    .getByRole("button", { name: "Send for coach review", exact: true })
    .dblclick();
  await expect(d).toHaveCount(0);
  await expect(
    page.getByText("Sent for coach review", { exact: true }),
  ).toBeVisible();
  expect(backend.rows).toHaveLength(1);
  expect(backend.counts.uploads).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Sent for coach review", { exact: true }),
  ).toBeVisible();
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
test("failed upload retries the same submission and deletion requires confirmation", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "athlete", true);
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Send a drill video" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Choose drill video").setInputFiles(file);
  await d
    .getByRole("button", { name: "Send for coach review", exact: true })
    .click();
  await expect(d.getByRole("alert")).toContainText("not confirmed");
  await d
    .getByRole("button", { name: "Retry sending video", exact: true })
    .click();
  await expect(d).toHaveCount(0);
  expect(backend.rows).toHaveLength(1);
  expect(backend.counts.uploads).toBe(2);
  await page.getByRole("button", { name: "Delete video", exact: true }).click();
  await page.getByRole("button", { name: "Keep video" }).click();
  expect(backend.counts.deletes).toBe(0);
  await page.getByRole("button", { name: "Delete video", exact: true }).click();
  await page.getByRole("button", { name: "Delete video permanently" }).click();
  await expect(
    page.getByText("Sent for coach review", { exact: true }),
  ).toHaveCount(0);
  expect(backend.rows).toHaveLength(0);
  expect(backend.counts.deletes).toBe(1);
});
test("assigned coach can open a private clip and save feedback once", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "coach");
  backend.rows.push({
    id: id(40),
    profile_id: playerId,
    account_id: userId,
    submitted_by: userId,
    resource_id: drillId,
    drill_title: content.title,
    asset_path: `${userId}/${playerId}/${id(40)}.webm`,
    media_type: "video/webm",
    byte_size: media.length,
    duration_seconds: 1,
    status: "queued",
    feedback: "",
    created_at: new Date().toISOString(),
    version: 2,
  });
  await page.goto("./?source=app#video-reviews");
  await page.getByRole("button", { name: "Open review" }).click();
  await expect(page.getByLabel("Private athlete practice video")).toBeVisible();
  await page
    .getByLabel("Coaching feedback")
    .fill("Keep your steps controlled and repeat at walking pace.");
  await page.getByRole("button", { name: "Send coaching feedback" }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.counts.feedback).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Coach feedback ready", { exact: true }),
  ).toBeVisible();
});
test("Owner can separately assign workouts and optional review access without charging", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "owner");
  await page.goto("./?source=app#access");
  const panel = page.getByRole("region", {
    name: "Workout and video package access",
  });
  await panel.getByLabel("Customer account").selectOption(userId);
  await panel.getByLabel("Fictional assigned footwork").check();
  await panel.getByLabel("Enable the optional video review feature").check();
  await panel.getByLabel("Assigned review coach").selectOption(coachId);
  await panel.getByRole("button", { name: "Review training access" }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  expect(backend.counts.access).toBe(0);
  await panel.getByRole("button", { name: "Review training access" }).click();
  await page
    .getByRole("button", { name: "Save training access", exact: true })
    .dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.counts.access).toBe(1);
});

test("multi-drill practice shows the order and next activity, allows review, and never treats playback or canceled practice as completion", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "athlete", false, 3);
  await page.goto("./?source=app#workspace");
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("list", { name: "Workout order" }).getByRole("listitem"),
  ).toHaveCount(3);
  await expect(
    dialog.getByText("Paper marker 3", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Begin workout" }).click();
  await expect(
    dialog.getByRole("heading", { name: content.title, exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByRole("progressbar", { name: "Current drill position" }),
  ).toHaveAttribute("value", "1");
  await expect(dialog.locator(".next-drill")).toContainText(
    "Fictional next drill 2",
  );
  await page.screenshot({
    path: `artifacts/guided-drill-${page.viewportSize()?.width}.png`,
  });
  await expect(dialog.locator("video")).toHaveAttribute("playsinline", "");
  await dialog
    .locator("video")
    .evaluate((el) => el.dispatchEvent(new Event("ended")));
  expect(backend.counts.reports).toBe(0);
  await dialog
    .getByRole("button", { name: "Complete drill · Next" })
    .dblclick();
  await expect(
    dialog.getByRole("heading", {
      name: "Fictional next drill 2",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("value", "2");
  await expect(
    dialog.getByText("Read marker 2.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Set two markers.", { exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      dialog.getByRole("button", { name: "Previous drill" }).isEnabled(),
    )
    .toBe(true);
  // A fresh intentional action follows the guard that coalesces repeated taps.
  await page.waitForTimeout(700);
  await dialog.getByRole("button", { name: "Previous drill" }).click();
  await expect(
    dialog.getByRole("heading", { name: content.title, exact: true }),
  ).toBeFocused();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("value", "1");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep practicing" }).click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "End workout", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Discard unfinished workout" })
    .click();
  expect(backend.counts.reports).toBe(0);
  await page.reload();
  expect(backend.counts.reports).toBe(0);
});
