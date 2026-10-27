import type { StaffAthlete } from "../../src/staffService";
export const uid = (n: number) =>
  `90000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const coachA = uid(70),
  coachB = uid(71);
/** Match the backend's derived next step after every fictional roster change. */
export function sampleNextAction(row: StaffAthlete): string {
  if (row.overdue_reviews) return "Follow up overdue review";
  if (row.blocked_reviews) return "Resolve review follow-up";
  if (!row.coach_id) return "Assign service coach";
  if (!row.workout_id) return "Assign training";
  if (!row.eligible_access) return "Review content or eligibility";
  if (!row.media_ready) return "Complete training upload";
  return row.last_completion_at
    ? "Review practice participation"
    : "Await observed practice report";
}
export function sampleRows(): StaffAthlete[] {
  const now = new Date().toISOString();
  return ["Jordan", "Avery", "Morgan"].map((name, i) => {
    const ready = i < 2,
      coach = i === 0 ? coachA : i === 1 ? coachB : null;
    return {
      client_id: uid(i === 2 ? 51 : 50),
      client_label:
        i === 2
          ? "fictional-solo@example.test"
          : "fictional-family@example.test",
      athlete_id: uid(60 + i),
      athlete_name: `Fictional ${name}`,
      age_group: "18+",
      position: i === 1 ? "Defensive back" : "Quarterback",
      experience: "New to the game",
      goal: "Footwork",
      coach_id: coach,
      coach_label: coach
        ? `Fictional Coach ${i === 0 ? "Alex" : "Blair"}`
        : null,
      coach_version: coach ? 1 : 0,
      workout_id: ready ? uid(80 + i) : null,
      workout_title: ready ? "Ready position & controlled steps" : "",
      workout_version: ready ? 1 : 0,
      assignment_updated_at: now,
      eligible_access: ready,
      media_ready: ready,
      resources: ready
        ? [
            {
              id: uid(90 + i),
              title: "Controlled steps · illustrative sample",
              version: 2,
              minutes: 8,
              review_stage: "approved",
              reviewed_by: uid(1),
              reviewed_at: now,
              upload_received: true,
            },
          ]
        : [],
      scheduled_at: null,
      first_available_at: null,
      schedule_tracking_available: false,
      observed_at: now,
      last_opened_at: null,
      open_tracking_available: false,
      last_practice_saved_at: ready ? now : null,
      last_completion_at: i === 0 ? now : null,
      pending_reviews: i === 0 ? 1 : 0,
      overdue_reviews: i === 0 ? 1 : 0,
      blocked_reviews: 0,
      review_scope: "all_for_athlete",
      review_tasks:
        i === 0
          ? [
              {
                id: uid(95),
                account_id: uid(50),
                profile_id: uid(60),
                video_id: null,
                assigned_to: coach,
                drill_title: "Controlled steps · fictional review",
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
        i === 0
          ? "Follow up overdue review"
          : i === 2
            ? "Assign service coach"
            : "Await observed practice report",
    };
  });
}
