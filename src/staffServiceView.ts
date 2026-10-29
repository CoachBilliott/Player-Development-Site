import type { StaffAthlete } from "./staffService";
export type ServiceState = "overdue" | "attention" | "ready";
export function serviceState(row: StaffAthlete): ServiceState {
  if (row.overdue_reviews) return "overdue";
  if (row.learning)
    return !row.athlete_id ||
      !row.coach_id ||
      row.blocked_reviews ||
      !["ready", "week_complete", "plan_complete", "awaiting_release"].includes(
        row.learning.status,
      )
      ? "attention"
      : "ready";
  return !row.athlete_id ||
    !row.coach_id ||
    !row.workout_id ||
    !row.eligible_access ||
    !row.media_ready ||
    row.blocked_reviews
    ? "attention"
    : "ready";
}
export const STATE_LABELS = {
  overdue: "Overdue review",
  attention: "Needs attention",
  ready: "Ready to train",
};
export function serviceAction(row: StaffAthlete, role: string) {
  if (row.overdue_reviews) return "Review overdue task";
  if (row.blocked_reviews) return "Resolve follow-up";
  if (!row.coach_id)
    return role === "owner" || role === "manager"
      ? "Assign service coach"
      : "View responsibility";
  if (row.learning) {
    const status = row.learning.status;
    if (status === "not_enrolled")
      return role === "owner" ? "Start weekly plan" : "Review enrollment needs";
    if (status === "needs_grading") return "Grade quiz answers";
    if (status === "needs_content" || status === "content_withdrawn")
      return "Review content readiness";
    if (status === "access_inactive") return "Review plan access";
    if (status === "paused") return "Review paused plan";
    if (status === "pending_parent") return "View parent review";
    if (status === "plan_complete") return "Review completed plan";
    return "View weekly plan";
  }
  if (!row.workout_id || !row.eligible_access || !row.media_ready)
    return "Review training needs";
  return row.pending_reviews ? "View review tasks" : "View athlete details";
}
const normal = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
export function serviceRows(
  rows: StaffAthlete[],
  query: string,
  filter: string,
) {
  const words = normal(query.trim()).split(/\s+/).filter(Boolean);
  return rows
    .filter((row) => {
      const state = serviceState(row);
      const matches =
        filter === "all" ||
        (filter === "overdue" && state === "overdue") ||
        (filter === "blocked" && state === "attention") ||
        (filter === "ready" && state === "ready") ||
        (filter === "unassigned" && !row.coach_id);
      const text = normal(
        [
          row.athlete_name,
          row.client_label,
          row.position,
          row.coach_label,
          row.workout_title,
          row.learning?.title,
          row.learning?.current_title,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return matches && words.every((word) => text.includes(word));
    })
    .sort((a, b) => {
      const priority = { overdue: 0, attention: 1, ready: 2 };
      return (
        priority[serviceState(a)] - priority[serviceState(b)] ||
        (a.athlete_name || a.client_label).localeCompare(
          b.athlete_name || b.client_label,
        )
      );
    });
}

export const WEEKLY_STATE_LABELS = {
  not_enrolled: "No weekly plan",
  access_inactive: "Access inactive",
  paused: "Plan paused",
  needs_grading: "Quiz grade needed",
  pending_parent: "Awaiting parent review",
  content_withdrawn: "Content withdrawn",
  needs_content: "Next week needs content",
  awaiting_release: "First week scheduled",
  plan_complete: "Plan work complete",
  week_complete: "This week submitted",
  ready: "Weekly work available",
} as const;
export function serviceLabel(row: StaffAthlete) {
  return row.overdue_reviews
    ? STATE_LABELS.overdue
    : row.learning
      ? WEEKLY_STATE_LABELS[row.learning.status]
      : STATE_LABELS[serviceState(row)];
}
