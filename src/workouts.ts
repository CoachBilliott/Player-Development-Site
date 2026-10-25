import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AGES, LEVELS, POSITIONS, type Drill, type Profile } from "./model";

export const savedWorkoutSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  resource_ids: z.array(z.string().uuid()),
  created_by: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  updated_at: z.string(),
});
export type SavedWorkout = z.infer<typeof savedWorkoutSchema>;
export const assignmentSchema = z.object({
  workout_id: z.string().uuid().nullable(),
  workout_title: z.string(),
  summary: z.string(),
  resource_ids: z.array(z.string().uuid()),
  workout_version: z.number().int(),
  version: z.number().int().nonnegative(),
});
export type WorkoutAssignment = z.infer<typeof assignmentSchema>;
export const noAssignment: WorkoutAssignment = {
  workout_id: null,
  workout_title: "",
  summary: "",
  resource_ids: [],
  workout_version: 0,
  version: 0,
};
export const athleteAssignmentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  resource_ids: z.array(z.string().uuid()),
  version: z.number().int().positive(),
  eligible: z.boolean(),
});
export type AthleteAssignment = z.infer<typeof athleteAssignmentSchema>;

export function workoutCoverage(drills: Drill[]) {
  return {
    ages: AGES.filter(
      (a) => drills.length > 0 && drills.every((d) => d.ages.includes(a)),
    ),
    levels: LEVELS.filter(
      (l) => drills.length > 0 && drills.every((d) => d.levels.includes(l)),
    ),
    positions: POSITIONS.filter(
      (p) =>
        drills.length > 0 &&
        drills.every((d) => !d.positions.length || d.positions.includes(p)),
    ),
  };
}
export function workoutIssue(ids: string[], resources: Drill[]) {
  if (!ids.length || ids.length > 12) return "Choose between 1 and 12 drills.";
  if (new Set(ids).size !== ids.length)
    return "Each drill can appear once in a workout.";
  const items = ids.map((id) => resources.find((d) => d.id === id));
  if (
    items.some(
      (d) =>
        !d ||
        d.visibility !== "member_only" ||
        d.source !== "shared" ||
        (d.reviewStage !== undefined && d.reviewStage !== "approved"),
    )
  )
    return "A selected drill is unavailable. Remove it or refresh the library.";
  const found = items as Drill[];
  if (found.some((d) => !Number.isInteger(d.minutes)))
    return "Set each drill's planned duration to whole minutes before adding it.";
  if (found.reduce((sum, d) => sum + d.minutes, 0) > 60)
    return "Keep this workout within 60 planned minutes.";
  const audience = workoutCoverage(found);
  if (
    !audience.ages.length ||
    !audience.levels.length ||
    !audience.positions.length
  )
    return "These drills do not share an age, position and experience audience. Choose a compatible set.";
  return "";
}
export function orderedWorkoutPlan(
  assignment: AthleteAssignment,
  available: Drill[],
  profile: Profile,
) {
  if (!assignment.eligible || workoutIssue(assignment.resource_ids, available))
    return [];
  const items = assignment.resource_ids.map((id) =>
    available.find((d) => d.id === id)!,
  );
  return items.every(
    (d) =>
      d.ages.includes(profile.age) &&
      d.levels.includes(profile.level) &&
      (!d.positions.length || d.positions.includes(profile.position)),
  )
    ? items
    : [];
}
export class Workouts {
  constructor(readonly client: SupabaseClient) {}
  async list() {
    const { data, error } = await this.client
      .from("training_workouts")
      .select("id,title,summary,resource_ids,created_by,version,updated_at")
      .order("updated_at", { ascending: false });
    if (error)
      throw new Error(
        "Saved workouts could not be loaded. Reconnect and refresh.",
      );
    return z.array(savedWorkoutSchema).parse(data || []);
  }
  async save(
    id: string,
    title: string,
    summary: string,
    resources: string[],
    version: number,
  ) {
    const { data, error } = await this.client.rpc("save_training_workout", {
      workout: id,
      title: title.trim(),
      summary: summary.trim(),
      resources,
      expected_version: version,
    });
    if (error)
      throw new Error(
        "Save was not confirmed. Keep your draft and refresh saved workouts before retrying; a drill or version may have changed.",
      );
    return savedWorkoutSchema.parse(data);
  }
  async remove(workout: SavedWorkout) {
    const { error } = await this.client.rpc("remove_training_workout", {
      workout: workout.id,
      expected_version: workout.version,
    });
    if (error)
      throw new Error(
        "Removal was not confirmed. Refresh saved workouts before retrying.",
      );
  }
  async assignment(account: string) {
    const { data, error } = await this.client
      .from("member_workout_assignments")
      .select(
        "workout_id,workout_title,summary,resource_ids,workout_version,version",
      )
      .eq("account_id", account)
      .maybeSingle();
    if (error)
      throw new Error(
        "The current assignment could not be loaded. Retry before making changes.",
      );
    return assignmentSchema.parse(data || noAssignment);
  }
  async preview(workout: SavedWorkout, account: string) {
    const { data, error } = await this.client.rpc(
      "workout_assignment_preview",
      {
        workout: workout.id,
        workout_version: workout.version,
        target_account: account,
      },
    );
    if (error)
      throw new Error(
        "Eligibility could not be checked. Refresh the workout and account before retrying.",
      );
    return z.object({ eligible: z.boolean() }).parse(data).eligible;
  }
  async assign(workout: SavedWorkout | null, account: string, version: number) {
    const { data, error } = await this.client.rpc("assign_training_workout", {
      target_account: account,
      workout: workout?.id || null,
      workout_version: workout?.version || 0,
      expected_version: version,
    });
    if (error)
      throw new Error(
        "Assignment was not confirmed. Reload this account before retrying; eligibility or another Owner's changes may have changed.",
      );
    return assignmentSchema.parse(data);
  }
}
