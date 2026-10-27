import type { BrowserContext } from "@playwright/test";
import { fixture, state, uid, staffId } from "./workoutFixture";
import type { StaffAthlete } from "../src/staffService";
export const buyerA = uid(50),
  buyerB = uid(51),
  athleteA = uid(60),
  athleteB = uid(61),
  athleteC = uid(62),
  coachA = uid(70),
  coachB = uid(71);
const now = new Date().toISOString();
function row(
  id: string,
  name: string,
  buyer: string,
  coach: string | null,
  ready = true,
): StaffAthlete {
  return {
    client_id: buyer,
    client_label:
      buyer === buyerA
        ? "fictional-family@example.test"
        : "fictional-solo@example.test",
    athlete_id: id,
    athlete_name: name,
    age_group: "18+",
    position: id === athleteB ? "Defensive back" : "Quarterback",
    experience: "New to the game",
    goal: "Footwork",
    coach_id: coach,
    coach_label: coach
      ? coach === coachA
        ? "fictional-coach-a@example.test"
        : "fictional-coach-b@example.test"
      : null,
    coach_version: coach ? 1 : 0,
    workout_id: ready ? uid(80) : null,
    workout_title: ready ? "Ready position & controlled steps" : "",
    workout_version: ready ? 1 : 0,
    assignment_updated_at: now,
    eligible_access: ready,
    media_ready: ready,
    resources: ready
      ? [
          {
            id: uid(90),
            title: "Ready position and controlled steps",
            version: 2,
            minutes: 8,
            review_stage: "approved",
            reviewed_by: staffId,
            reviewed_at: now,
            upload_received: true,
          },
        ]
      : [],
    scheduled_at: null,
    release_timezone: null,
    first_available_at: null,
    schedule_tracking_available: false,
    observed_at: now,
    last_opened_at: null,
    open_tracking_available: false,
    last_practice_saved_at: ready ? now : null,
    last_completion_at: id === athleteA ? now : null,
    pending_reviews: id === athleteA ? 1 : 0,
    overdue_reviews: id === athleteA ? 1 : 0,
    blocked_reviews: 0,
    review_scope: "all_for_athlete",
    review_tasks:
      id === athleteA
        ? [
            {
              id: uid(95),
              account_id: buyer,
              profile_id: id,
              video_id: null,
              assigned_to: coach,
              drill_title: "Controlled steps · test review",
              state: "queued",
              funding: "manual_pilot",
              blocker: "none",
              ready_at: new Date(Date.now() - 49 * 3600000).toISOString(),
              due_at: new Date(Date.now() - 3600000).toISOString(),
              delivered_at: null,
              created_at: now,
              updated_at: now,
              version: 1,
            },
          ]
        : [],
    purchase: null,
    payment_tracking_available: false,
    notification_status: null,
    notification_tracking_available: false,
    next_action:
      id === athleteA
        ? "Follow up overdue review"
        : !coach
          ? "Assign service coach"
          : !ready
            ? "Assign training"
            : "Await observed practice report",
  };
}
export function staffState() {
  return {
    rows: [
      row(athleteA, "Fictional Jordan", buyerA, coachA),
      row(athleteB, "Fictional Avery", buyerA, coachB),
      row(athleteC, "Fictional Morgan", buyerB, null, false),
    ],
    counts: { writes: 0 },
  };
}
export async function staffFixture(
  context: BrowserContext,
  data: ReturnType<typeof staffState>,
  role = "owner",
  actor = staffId,
) {
  await fixture(context, state(), role, actor);
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        staffRosterEnabled: true,
      },
    }),
  );
  await context.route(
    "https://separate-demo.supabase.co/rest/v1/rpc/**",
    async (route) => {
      const p = new URL(route.request().url()).pathname,
        body = route.request().postDataJSON();
      const allowed = (r: StaffAthlete) =>
        ["owner", "manager"].includes(role) ||
        (role === "coach" && r.coach_id === actor);
      const view = (r: StaffAthlete) =>
        role === "coach"
          ? {
              ...r,
              client_label: `Client ${r.client_id.slice(0, 8)}`,
              review_scope: "assigned_only",
            }
          : r;
      if (p.endsWith("/staff_client_service_roster"))
        return route.fulfill({
          json: {
            source: "account_backend",
            scope:
              role === "coach" ? "assigned_athletes" : "all_repformed_clients",
            rows: data.rows.filter(allowed).map(view),
            coaches:
              role === "owner"
                ? [
                    { id: coachA, label: "fictional-coach-a@example.test" },
                    { id: coachB, label: "fictional-coach-b@example.test" },
                  ]
                : [],
          },
        });
      if (p.endsWith("/staff_athlete_service")) {
        const r = data.rows.find((r) => r.athlete_id === body.target_profile);
        return r && allowed(r)
          ? route.fulfill({ json: view(r) })
          : route.fulfill({
              status: 403,
              json: { message: "Outside service roster" },
            });
      }
      if (p.endsWith("/assign_athlete_service_coach")) {
        if (role !== "owner")
          return route.fulfill({
            status: 403,
            json: { message: "Owner access required" },
          });
        const r = data.rows.find((r) => r.athlete_id === body.target_profile)!;
        data.counts.writes++;
        r.coach_id = body.coach;
        r.coach_label =
          body.coach === coachA
            ? "fictional-coach-a@example.test"
            : body.coach === coachB
              ? "fictional-coach-b@example.test"
              : null;
        r.coach_version = (r.coach_version || 0) + 1;
        return route.fulfill({ json: {} });
      }
      return route.fallback();
    },
  );
}
