import type { StaffAthlete } from "./staffService";
export type ServiceState = "overdue" | "attention" | "ready";
export function serviceState(row: StaffAthlete): ServiceState {
  if (row.overdue_reviews) return "overdue";
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
