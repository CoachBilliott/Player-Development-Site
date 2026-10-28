import { describe, it, expect } from "vitest";
import type { StaffAthlete } from "./staffService";
import {
  serviceState,
  serviceAction,
  serviceLabel,
  serviceRows,
} from "./staffServiceView";
const row = (
  status: NonNullable<StaffAthlete["learning"]>["status"],
): StaffAthlete => ({
  client_id: "91000000-0000-4000-8000-000000000001",
  client_label: "Fictional client",
  athlete_id: "91000000-0000-4000-8000-000000000002",
  athlete_name: "Fictional athlete",
  coach_id: "91000000-0000-4000-8000-000000000003",
  workout_id: null,
  eligible_access: false,
  media_ready: false,
  resources: [],
  review_tasks: [],
  next_action: "View weekly training",
  learning: {
    enabled: true,
    enrollment_id: "enrollment",
    title: "Versioned weekly path",
    status,
    ready_weeks: 2,
    pending_grades: 0,
    pending_parent: 0,
  },
});
describe("weekly service presentation", () => {
  it("treats a ready weekly enrollment as ready even without a legacy saved workout", () => {
    expect(serviceState(row("ready"))).toBe("ready");
    expect(serviceAction(row("ready"), "owner")).toBe("View weekly plan");
    expect(serviceLabel(row("ready"))).toBe("Weekly work available");
  });
  it("surfaces weekly tasks without turning a quiz grade into an overdue video review", () => {
    expect(serviceState(row("needs_grading"))).toBe("attention");
    expect(serviceAction(row("needs_grading"), "coach")).toBe(
      "Grade quiz answers",
    );
    expect(serviceLabel(row("needs_grading"))).toBe("Quiz grade needed");
    expect(
      serviceAction({ ...row("ready"), overdue_reviews: 1 }, "coach"),
    ).toBe("Review overdue task");
  });
  it("keeps Owner enrollment wording distinct from staff read-only review and finds plan names", () => {
    expect(serviceAction(row("not_enrolled"), "owner")).toBe(
      "Start weekly plan",
    );
    expect(serviceAction(row("not_enrolled"), "manager")).toBe(
      "Review enrollment needs",
    );
    expect(serviceRows([row("ready")], "versioned path", "ready")).toHaveLength(
      1,
    );
    expect(serviceRows([row("paused")], "", "ready")).toHaveLength(0);
  });
});
