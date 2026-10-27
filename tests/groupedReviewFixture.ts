import type { BrowserContext } from "@playwright/test";
import {
  fixture as base,
  userId,
  playerId,
  drillId,
  coachId,
  media,
} from "./videoReviewFixture";
import type { ReviewGroup } from "../src/reviewGroups";
export function groupedState() {
  return {
    groups: new Map<string, ReviewGroup>(),
    uploaded: new Set<string>(),
    failSecond: true,
    failCreateResponse: false,
    counts: { creates: 0, uploads: 0, submits: 0, feedback: 0 },
  };
}
export async function groupedFixture(
  context: BrowserContext,
  state: ReturnType<typeof groupedState>,
  role = "athlete",
  actor = userId,
) {
  await base(context, role, false, 1, true, actor);
  await context.route("https://separate-demo.supabase.co/**", async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      p = u.pathname;
    const body = (p.includes("/rpc/") ? req.postDataJSON() : {}) as Record<
      string,
      unknown
    >;
    const json = (v: unknown, status = 200) =>
      route.fulfill({ json: v, status });
    const group = state.groups.get(String(body.request_id));
    const allowed = (g: ReviewGroup) =>
      actor === userId ||
      (actor === g.assigned_to && !!g.group_submitted_at && !g.erased);
    if (p.endsWith("/rpc/athlete_video_state"))
      return json({
        can_submit: true,
        adult_only: false,
        remaining_slots:
          5 -
          [...state.groups.values()].reduce((n, g) => n + g.clips.length, 0),
        service_tracking: true,
        services: [...state.groups.values()],
        grouped_reviews_ready: actor === userId,
        groups: actor === userId ? [...state.groups.values()] : [],
        reviews: [...state.groups.values()].flatMap((g) => g.clips),
      });
    if (p.endsWith("/rpc/create_review_group")) {
      if (actor !== userId) return json({ message: "Unavailable" }, 403);
      if (group) return json(group);
      const clips = body.clips as {
        id: string;
        training_id: string;
        media_type: string;
        byte_size: number;
        duration_seconds: number;
      }[];
      if (
        clips.length > 3 ||
        clips.length < 1 ||
        clips.some((c) => c.duration_seconds > 60) ||
        clips.reduce((n, c) => n + c.duration_seconds, 0) > 180
      )
        return json({ message: "Invalid clip limits" }, 400);
      if (
        [...state.groups.values()].reduce((n, g) => n + g.clips.length, 0) +
          clips.length >
        5
      )
        return json({ message: "Not enough current storage capacity." }, 400);
      state.counts.creates++;
      const now = new Date().toISOString();
      const g: ReviewGroup = {
        id: String(body.request_id),
        account_id: userId,
        profile_id: playerId,
        video_id: null,
        assigned_to: coachId,
        drill_title: "Fictional assigned footwork",
        state: "uploading",
        funding: "manual_pilot",
        blocker: "none",
        ready_at: null,
        due_at: null,
        delivered_at: null,
        created_at: now,
        updated_at: now,
        version: 1,
        is_grouped: true,
        group_submitted_at: null,
        feedback: "",
        erased: false,
        clip_count: clips.length,
        total_seconds: clips.reduce((n, c) => n + c.duration_seconds, 0),
        clips: clips.map((c, n) => ({
          ...c,
          media_type: c.media_type as
            "video/mp4" | "video/quicktime" | "video/webm",
          profile_id: playerId,
          account_id: userId,
          submitted_by: userId,
          resource_id: drillId,
          drill_title: "Fictional assigned footwork",
          asset_path: `${userId}/${playerId}/${c.id}.webm`,
          status: "uploading",
          feedback: "",
          created_at: now,
          version: 1,
          review_request_id: String(body.request_id),
          clip_ordinal: n + 1,
        })),
      };
      state.groups.set(g.id, g);
      if (state.failCreateResponse) {
        state.failCreateResponse = false;
        return json(
          { message: "Fictional lost draft response. Retry the same draft." },
          500,
        );
      }
      return json(g);
    }
    if (p.endsWith("/rpc/review_group_detail"))
      return group && allowed(group)
        ? json(group)
        : json({ message: "This review group is unavailable." }, 403);
    if (
      p.startsWith("/storage/v1/object/athlete-review-videos/") &&
      req.method() === "POST"
    ) {
      const clip = [...state.groups.values()]
        .flatMap((g) => g.clips)
        .find((c) => p.endsWith(c.asset_path));
      if (!clip) return route.fallback();
      state.counts.uploads++;
      if (clip.clip_ordinal === 2 && state.failSecond) {
        state.failSecond = false;
        return json({ message: "Fictional connection interrupted" }, 500);
      }
      state.uploaded.add(clip.id);
      return json({ Key: clip.asset_path });
    }
    if (p.endsWith("/rpc/finish_athlete_video")) {
      const clip = [...state.groups.values()]
        .flatMap((g) => g.clips)
        .find((c) => c.id === body.review_id);
      if (!clip) return route.fallback();
      if (!state.uploaded.has(clip.id))
        return json({ message: "Complete upload unconfirmed" }, 400);
      if (clip.status === "uploading") {
        clip.status = "queued";
        clip.version++;
      }
      return json(clip);
    }
    if (p.endsWith("/rpc/submit_review_group")) {
      if (!group || actor !== userId)
        return json({ message: "Unavailable" }, 403);
      if (group.clips.some((c) => c.status === "uploading"))
        return json({ message: "Upload every clip" }, 400);
      if (!group.group_submitted_at) {
        state.counts.submits++;
        group.group_submitted_at = new Date().toISOString();
        group.ready_at = group.group_submitted_at;
        group.due_at = new Date(
          Date.parse(group.ready_at) + 48 * 3600000,
        ).toISOString();
        group.state = "queued";
        group.version++;
      }
      return json(group);
    }
    if (p.endsWith("/athlete_video_reviews") && req.method() === "GET")
      return json(
        [...state.groups.values()]
          .filter((g) => allowed(g) && g.group_submitted_at && !g.erased)
          .flatMap((g) => g.clips),
      );
    if (p.endsWith("/rpc/start_review_group")) {
      if (!group || actor !== group.assigned_to || !allowed(group))
        return json({ message: "Assigned coach access required" }, 403);
      if (group.state === "queued") {
        group.state = "in_review";
        group.version++;
      }
      return json(group);
    }
    if (p.endsWith("/rpc/save_review_group_feedback")) {
      if (!group || actor !== group.assigned_to || !allowed(group))
        return json({ message: "Assigned coach access required" }, 403);
      if (group.feedback !== body.feedback_text) {
        state.counts.feedback++;
        group.feedback = String(body.feedback_text);
        group.state = "delivered";
        group.delivered_at = new Date().toISOString();
        group.version++;
        group.clips.forEach((c) => (c.status = "reviewed"));
      }
      return json(group);
    }
    if (p.endsWith("/rpc/delete_review_group")) {
      if (!group || actor !== userId)
        return json({ message: "Unavailable" }, 403);
      group.clips = [];
      group.clip_count = 0;
      group.total_seconds = 0;
      group.erased = true;
      group.feedback = "";
      group.state = group.delivered_at ? "delivered" : "cancelled";
      return json(null);
    }
    if (p.endsWith("/rpc/review_service_desk"))
      return json({
        requests: [...state.groups.values()],
        staff: [
          { id: coachId, label: "fictional-coach@example.test", role: "coach" },
        ],
      });
    if (p.includes("/storage/v1/object/sign/"))
      return req.method() === "POST"
        ? json({
            signedURL:
              "/object/sign/athlete-review-videos/group.webm?token=fictional",
          })
        : route.fulfill({ body: media, contentType: "video/webm" });
    if (
      p.endsWith("/storage/v1/object/athlete-review-videos") &&
      req.method() === "DELETE"
    )
      return json([]);
    return route.fallback();
  });
}
