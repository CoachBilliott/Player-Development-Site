import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Drill } from "./model";
import type { AthleteAssignment } from "./workouts";
export const practiceResumeSchema = z
  .object({
    profile_id: z.string().uuid(),
    session_id: z.string().uuid(),
    resource_ids: z.array(z.string().uuid()).min(1).max(12),
    resource_versions: z.array(z.number().int().positive()),
    current_index: z.number().int().nonnegative(),
    workout_id: z.string().uuid().nullable(),
    workout_version: z.number().int().nullable(),
    assignment_version: z.number().int().nonnegative(),
    permission_version: z.number().int().nonnegative(),
    version: z.number().int().positive(),
    updated_at: z.string(),
    expires_at: z.string(),
  })
  .refine(
    (r) =>
      r.current_index < r.resource_ids.length &&
      r.resource_versions.length === r.resource_ids.length,
  );
export type PracticeResume = z.infer<typeof practiceResumeSchema>;
export function resumeItems(
  resume: PracticeResume,
  available: Drill[],
  assignment?: AthleteAssignment | null,
) {
  if (
    resume.workout_id !== (assignment?.eligible ? assignment.id : null) ||
    (resume.workout_id && resume.workout_version !== assignment?.version)
  )
    return null;
  if (
    assignment?.eligible &&
    (assignment.resource_ids.length !== resume.resource_ids.length ||
      assignment.resource_ids.some((id, i) => id !== resume.resource_ids[i]))
  )
    return null;
  const items = resume.resource_ids.map((id, i) =>
    available.find(
      (d) =>
        d.id === id &&
        d.backendVersion === resume.resource_versions[i] &&
        (d.reviewStage === undefined || d.reviewStage === "approved"),
    ),
  );
  return items.every((d): d is Drill => !!d) ? (items as Drill[]) : null;
}
export class PracticeResumes {
  constructor(private readonly client: SupabaseClient) {}
  async load(profile: string) {
    const { data, error } = await this.client.rpc("load_practice_resume", {
      target_profile: profile,
    });
    if (error)
      throw new Error(
        "Saved practice could not be checked. Reconnect and refresh training before starting.",
      );
    return data ? practiceResumeSchema.parse(data) : null;
  }
  async save(
    profile: string,
    session: string,
    items: Drill[],
    index: number,
    version: number,
    assignment?: AthleteAssignment,
  ) {
    const { data, error } = await this.client.rpc("save_practice_resume", {
      target_profile: profile,
      session,
      resources: items.map((d) => d.id),
      resource_versions: items.map((d) => d.backendVersion),
      current_position: index,
      expected_version: version,
      expected_workout: assignment?.id || null,
      expected_workout_version: assignment?.version || null,
    });
    if (error)
      throw new Error(
        "Your place was not saved, or this workout changed on another device. Keep this screen open and retry, or leave and refresh training.",
      );
    return practiceResumeSchema.parse(data);
  }
  async discard(profile: string, resume: PracticeResume) {
    const { error } = await this.client.rpc("discard_practice_resume", {
      target_profile: profile,
      session: resume.session_id,
      expected_version: resume.version,
    });
    if (error)
      throw new Error(
        "Saved practice changed on another device. Refresh training before discarding it.",
      );
  }
}
