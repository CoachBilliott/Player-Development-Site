import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Drill } from "./model";
import { SharedContent } from "./sharedContent";
import type { PrivatePlayer } from "./accounts";
export const workoutSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  reported_by: z.string().uuid().nullable(),
  drill_ids: z.array(z.string()),
  titles: z.array(z.string()),
  minutes: z.number().int().positive(),
  status: z.enum([
    "pending_parent",
    "approved",
    "needs_repeat",
    "self_reported",
  ]),
  created_at: z.string(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().nullable(),
  version: z.number().int().positive(),
});
export type AthleteWorkout = z.infer<typeof workoutSchema>;
export const familyStateSchema = z.object({
  guardian_managed: z.boolean().default(false),
  is_family: z.boolean(),
  is_parent: z.boolean(),
  can_record: z.boolean(),
  self_recording_allowed: z.boolean(),
  permission_version: z.number().int().nonnegative(),
  has_link: z.boolean(),
  child_access_ready: z.boolean(),
  workouts: z.array(workoutSchema),
});
export type FamilyState = z.infer<typeof familyStateSchema>;
export type FamilyService = {
  plan?: (player: PrivatePlayer) => Promise<Drill[]>;
  load: (player: PrivatePlayer) => Promise<FamilyState>;
  permission: (
    player: PrivatePlayer,
    allowed: boolean,
    version: number,
  ) => Promise<void>;
  report: (
    player: PrivatePlayer,
    id: string,
    drills: string[],
  ) => Promise<void>;
  review: (
    id: string,
    decision: "approved" | "needs_repeat",
    version: number,
  ) => Promise<void>;
  invite: (player: PrivatePlayer) => Promise<string>;
  remove: (player: PrivatePlayer) => Promise<void>;
};
export const WORKOUT_LABELS: Record<AthleteWorkout["status"], string> = {
  pending_parent: "Awaiting parent review",
  approved: "Parent approved",
  needs_repeat: "Practice again together",
  self_reported: "Self-reported practice",
};
function failure(error: unknown, fallback: string) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  const allowed = [
    "Only this athlete",
    "The parent has paused",
    "Under-18 workout",
    "This workout was already",
    "Permission changed",
    "Child access requires",
    "Remove the existing athlete",
    "This profile already",
    "This Athlete account already",
    "Adult athletes must",
    "Use a separate Athlete",
    "Verify your email",
    "This access code is unavailable",
    "The parent has not enabled",
  ];
  return new Error(
    allowed.some((start) => message.startsWith(start)) ? message : fallback,
  );
}
export class FamilyTraining implements FamilyService {
  constructor(readonly client: SupabaseClient) {}
  async plan(player: PrivatePlayer) {
    return new SharedContent(this.client).listForPlayer(player.id);
  }
  async load(player: PrivatePlayer) {
    const { data, error } = await this.client.rpc("family_profile_state", {
      target_profile: player.id,
    });
    if (error)
      throw failure(
        error,
        "This athlete’s permissions and workout history could not be loaded. Reconnect and refresh.",
      );
    return familyStateSchema.parse(data);
  }
  async permission(player: PrivatePlayer, allowed: boolean, version: number) {
    const { error } = await this.client.rpc("set_athlete_permission", {
      target_profile: player.id,
      allowed,
      expected_version: version,
    });
    if (error)
      throw failure(
        error,
        "Permission was not confirmed. Refresh before retrying.",
      );
  }
  async report(player: PrivatePlayer, id: string, drills: string[]) {
    const { error } = await this.client.rpc("report_athlete_workout", {
      workout_id: id,
      target_profile: player.id,
      requested_drills: drills,
    });
    if (error) {
      const { data } = await this.client
        .from("athlete_workouts")
        .select("id,profile_id,reported_by,drill_ids")
        .eq("id", id)
        .maybeSingle();
      const { data: auth } = await this.client.auth.getSession();
      if (
        data?.profile_id === player.id &&
        data.reported_by === auth.session?.user.id &&
        JSON.stringify(data.drill_ids) === JSON.stringify(drills)
      )
        return;
      throw failure(
        error,
        "Workout submission was not confirmed. Your session is still here; refresh the history before retrying.",
      );
    }
  }
  async review(
    id: string,
    decision: "approved" | "needs_repeat",
    version: number,
  ) {
    const { error } = await this.client.rpc("review_athlete_workout", {
      workout_id: id,
      decision,
      expected_version: version,
    });
    if (error)
      throw failure(
        error,
        "Review was not confirmed. Refresh the history before retrying.",
      );
  }
  async invite(player: PrivatePlayer) {
    const { data, error } = await this.client.rpc("create_athlete_invite", {
      target_profile: player.id,
    });
    if (error)
      throw failure(error, "An athlete access code could not be created.");
    return z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .parse(data);
  }
  async remove(player: PrivatePlayer) {
    const { error } = await this.client.rpc("remove_athlete_access", {
      target_profile: player.id,
    });
    if (error)
      throw failure(
        error,
        "The connection change was not confirmed. Refresh before retrying.",
      );
  }
  async accept(code: string) {
    const { data, error } = await this.client.rpc("accept_athlete_invite", {
      access_code: code.trim(),
    });
    if (error)
      throw failure(
        error,
        "This access code could not be accepted. Verify your email, check the code and ask the parent whether access is enabled. Child access remains closed pending consent setup.",
      );
    return z.string().uuid().parse(data);
  }
}
