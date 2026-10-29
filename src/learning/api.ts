import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuizImport } from "./quizImport";
import type { LessonAllocations } from "./packageReadiness";
const question = z.object({
  id: z.string(),
  order: z.number(),
  type: z.enum(["multiple_choice", "true_false", "written"]),
  question: z.string(),
  options: z.array(z.string()),
  points: z.number(),
});
const quiz = z.object({
  id: z.string(),
  title: z.string(),
  total_points: z.number(),
  questions: z.array(question),
});
const grade = z.object({
  revision: z.number(),
  points: z.record(z.string(), z.number()),
  feedback: z.string(),
  graded_at: z.string(),
});
const attempt = z.object({
  id: z.string(),
  quiz_version_id: z.string(),
  actor_id: z.string().nullable(),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  state: z.enum(["draft", "needs_grading", "graded"]),
  objective_points: z.number().nullable(),
  submitted_at: z.string().nullable(),
  version: z.number(),
  grades: z.array(grade),
});
const resource = z.object({
  learning_kind: z.enum(["iq", "movement", "position"]).nullable().optional(),
  lesson_quiz_id: z.string().nullable().optional(),
  id: z.string(),
  version: z.number(),
  content: z.object({
    title: z.string(),
    lesson: z.string().optional(),
    steps: z.array(z.string()).optional(),
    cue: z.string().optional(),
    minutes: z.number().optional(),
    equipment: z.string().optional(),
  }),
  asset_path: z.string(),
  asset_type: z.string(),
  asset_name: z.string(),
});
const release = z.object({
  id: z.string(),
  sequence: z.number(),
  week_number: z.number(),
  title: z.string(),
  available_at: z.string(),
  scheduled_at: z.string(),
  content_blocked: z.boolean().default(false),
  done: z.boolean(),
  resources: z.array(resource),
  quizzes: z.array(quiz),
  completion_reviews: z
    .array(
      z.object({
        item_id: z.string(),
        status: z.enum([
          "approved",
          "pending_parent",
          "needs_repeat",
          "self_reported",
        ]),
        version: z.number(),
        completed_at: z.string(),
        reviewed_at: z.string().nullable(),
      }),
    )
    .default([]),
  completed_items: z.array(z.string()),
  attempts: z.array(attempt),
});
export const athleteSchema = z.object({
  can_submit: z.boolean().default(false),
  is_guardian: z.boolean().default(false),
  enrollments: z.array(
    z.object({
      id: z.string(),
      plan_id: z.string(),
      title: z.string(),
      state: z.enum(["active", "paused", "ended", "finished"]),
      next_week: z.number(),
      next_release_at: z.string(),
      version: z.number(),
      access_active: z.boolean(),
      releases: z.array(release),
    }),
  ),
});
const week = z.object({
  id: z.string(),
  week_number: z.number(),
  title: z.string(),
  revision: z.number(),
  approved_at: z.string().nullable(),
  retracted_at: z.string().nullable().optional(),
  ready: z.boolean(),
  readiness: z
    .object({
      mode: z.enum(["package", "orientation", "test", "invalid"]),
      complete: z.boolean(),
      ready: z.boolean(),
      missing: z.array(z.string()),
      required: z
        .object({
          iq: z.number().optional(),
          movement: z.number().optional(),
          position: z.number().optional(),
          quizzes: z.number().optional(),
        })
        .optional(),
      actual: z
        .object({
          iq: z.number(),
          movement: z.number(),
          position: z.number(),
          quizzes: z.number(),
        })
        .optional(),
    })
    .optional(),
  quiz_version_ids: z.array(z.string()),
  resources: z.array(resource),
});
export const catalogSchema = z.object({
  rules: z
    .object({ friday_time: z.string(), low_ready_weeks: z.number() })
    .default({ friday_time: "17:00:00", low_ready_weeks: 2 }),
  plans: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      weeks: z.number(),
      package_ids: z.array(z.string()),
      ages: z.array(z.string()),
      positions: z.array(z.string()),
      weeks_content: z.array(week),
    }),
  ),
  quizzes: z.array(
    quiz.extend({
      quiz_id: z.string(),
      revision: z.number(),
      keys: z.array(
        z.object({
          id: z.string(),
          correct: z.number().nullable(),
          explanation: z.string(),
        }),
      ),
    }),
  ),
  cohorts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      profiles: z.array(z.string()),
      members: z
        .array(z.object({ id: z.string(), name: z.string() }))
        .default([]),
    }),
  ),
});
export type LearningAthleteData = z.infer<typeof athleteSchema>;
export type LearningCatalog = z.infer<typeof catalogSchema>;
export type LearningRelease = z.infer<typeof release>;
export type LearningQuiz = z.infer<typeof quiz>;
export type LearningAttempt = z.infer<typeof attempt>;
export type SaveAttemptResult = {
  id: string;
  state: LearningAttempt["state"];
  version: number;
  objective_points: number | null;
};
export const noticeSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  athlete_name: z.string().optional(),
  next_due_at: z.string().nullable().optional(),
  release_id: z.string().nullable(),
  category: z.enum([
    "content_ready",
    "friday_incomplete",
    "low_content",
    "no_content",
  ]),
  created_at: z.string(),
  read: z.boolean(),
});
export type LearningNotice = z.infer<typeof noticeSchema>;
export const groupResultSchema = z.array(
  z.object({
    profile_id: z.string(),
    name: z.string(),
    releases: z.number(),
    completed_weeks: z.number(),
    quiz_attempts: z.array(
      z.object({
        quiz: z.string(),
        week_number: z.number(),
        state: z.enum(["draft", "needs_grading", "graded"]),
        submitted_at: z.string().nullable(),
        objective_points: z.number().nullable(),
        total_points: z.number(),
        written_points: z.number(),
      }),
    ),
  }),
);
export const cohortPreviewSchema = z.object({
  members: z.array(
    z.object({
      name: z.string(),
      state: z.enum([
        "unavailable",
        "keep_existing",
        "different_running_plan",
        "eligibility_needed",
        "new_enrollment",
      ]),
    }),
  ),
  new_count: z.number(),
  kept_count: z.number(),
  blocked_count: z.number(),
});
export type CohortPreview = z.infer<typeof cohortPreviewSchema>;
export type LearningGroupResults = z.infer<typeof groupResultSchema>;
export interface LearningTransport {
  groupResults(group: string): Promise<LearningGroupResults>;
  configureRules(time: string, threshold: number): Promise<void>;
  override(enrollment: string, week: number, version: string): Promise<void>;
  inbox(): Promise<LearningNotice[]>;
  readNotice(id: string): Promise<void>;
  catalog(): Promise<LearningCatalog>;
  athlete(profile: string): Promise<LearningAthleteData>;
  importQuiz(
    title: string,
    data: QuizImport,
    operation: string,
    targetQuiz?: string,
  ): Promise<void>;
  createPlan(
    id: string,
    title: string,
    weeks: number,
    packages: string[],
    ages: string[],
    positions: string[],
  ): Promise<void>;
  saveWeek(
    id: string,
    plan: string,
    week: number,
    title: string,
    resources: string[],
    quizzes: string[],
    allocations?: LessonAllocations,
  ): Promise<void>;
  approveWeek(id: string): Promise<void>;
  enroll(id: string, profile: string, plan: string): Promise<void>;
  control(
    enrollment: string,
    action: "pause" | "resume" | "end" | "repeat",
    version: number,
    release?: string,
  ): Promise<void>;
  setAccess(
    profile: string,
    packageId: string,
    start: string,
    end: string,
    reason: string,
    revoke: boolean,
  ): Promise<void>;
  saveCohort(id: string, title: string, profiles: string[]): Promise<void>;
  previewCohort(group: string, plan: string): Promise<CohortPreview>;
  enrollCohort(group: string, plan: string, operation: string): Promise<number>;
  saveAttempt(
    id: string,
    release: string,
    quiz: string,
    answers: LearningAttempt["answers"],
    submit: boolean,
    version: number,
  ): Promise<SaveAttemptResult>;
  grade(
    id: string,
    marks: Record<string, number>,
    feedback: string,
    revision: number,
  ): Promise<void>;
  complete(release: string, item: string): Promise<void>;
  reviewCompletion(
    release: string,
    item: string,
    decision: "approved" | "needs_repeat",
    version: number,
  ): Promise<void>;
  media(path: string): Promise<string>;
}
export class LearningApi implements LearningTransport {
  private pendingMutations = 0;
  constructor(
    private client: SupabaseClient,
    private onMutation?: (busy: boolean) => void,
  ) {}
  private async rpc(name: string, args: Record<string, unknown> = {}) {
    const mutation = ![
      "learning_catalog",
      "learning_athlete",
      "learning_inbox",
    ].includes(name);
    if (mutation) {
      this.pendingMutations++;
      this.onMutation?.(true);
    }
    try {
      const { data, error } = await this.client.rpc(name, args);
      if (error) throw Error(error.message);
      return data as unknown;
    } finally {
      if (mutation) {
        this.pendingMutations--;
        this.onMutation?.(this.pendingMutations > 0);
      }
    }
  }
  async groupResults(group: string) {
    return groupResultSchema.parse(
      await this.rpc("learning_group_results", { target_cohort: group }),
    );
  }
  async configureRules(time: string, threshold: number) {
    await this.rpc("learning_configure_rules", {
      friday_clock: time,
      ready_threshold: threshold,
    });
  }
  async override(enrollment: string, week: number, version: string) {
    await this.rpc("learning_set_override", {
      target_enrollment: enrollment,
      week_no: week,
      target_week: version,
    });
  }
  async inbox() {
    return z.array(noticeSchema).parse(await this.rpc("learning_inbox"));
  }
  async readNotice(id: string) {
    await this.rpc("learning_read_notice", { target_notice: id });
  }
  async catalog() {
    return catalogSchema.parse(await this.rpc("learning_catalog"));
  }
  async athlete(profile: string) {
    return athleteSchema.parse(
      await this.rpc("learning_athlete", { target_profile: profile }),
    );
  }
  async importQuiz(
    title: string,
    data: QuizImport,
    operation: string,
    targetQuiz?: string,
  ) {
    await this.rpc("learning_import_quiz", {
      version_id: operation,
      target_quiz: targetQuiz || operation,
      quiz_title: title,
      payload: data,
    });
  }
  async createPlan(
    id: string,
    title: string,
    weeks: number,
    packages: string[],
    ages: string[],
    positions: string[],
  ) {
    await this.rpc("learning_create_plan", {
      target_id: id,
      plan_title: title,
      week_count: weeks,
      packages,
      age_groups: ages,
      position_groups: positions,
    });
  }
  async saveWeek(
    id: string,
    plan: string,
    week: number,
    title: string,
    resources: string[],
    quizzes: string[],
    allocations: LessonAllocations = {},
  ) {
    await this.rpc("learning_save_week_checked", {
      target_id: id,
      target_plan: plan,
      week_no: week,
      week_title: title,
      resource_ids: resources,
      quizzes,
      lesson_allocations: allocations,
    });
  }
  async approveWeek(id: string) {
    await this.rpc("learning_approve_week", { target_week: id });
  }
  async enroll(id: string, profile: string, plan: string) {
    await this.rpc("learning_enroll", {
      target_id: id,
      target_profile: profile,
      target_plan: plan,
      orientation_now: true,
    });
  }
  async control(
    enrollment: string,
    action: "pause" | "resume" | "end" | "repeat",
    version: number,
    release?: string,
  ) {
    await this.rpc("learning_control", {
      target_enrollment: enrollment,
      action_name: action,
      expected_version: version,
      target_release: release || null,
    });
  }
  async setAccess(
    profile: string,
    packageId: string,
    start: string,
    end: string,
    reason: string,
    revoke: boolean,
  ) {
    await this.rpc("learning_set_access", {
      target_profile: profile,
      package_name: packageId,
      starts: start,
      ends: end,
      reason_text: reason,
      revoke,
    });
  }
  async saveCohort(id: string, title: string, profiles: string[]) {
    await this.rpc("learning_save_cohort", {
      target_id: id,
      cohort_title: title,
      profiles,
    });
  }
  async previewCohort(group: string, plan: string) {
    return cohortPreviewSchema.parse(
      await this.rpc("learning_group_enrollment_preview", {
        target_cohort: group,
        target_plan: plan,
      }),
    );
  }
  async enrollCohort(group: string, plan: string, operation: string) {
    return z
      .number()
      .int()
      .nonnegative()
      .parse(
        await this.rpc("learning_enroll_cohort", {
          target_cohort: group,
          target_plan: plan,
          operation_id: operation,
        }),
      );
  }
  async saveAttempt(
    id: string,
    release: string,
    quiz: string,
    answers: LearningAttempt["answers"],
    submit: boolean,
    version: number,
  ) {
    return z
      .object({
        id: z.string(),
        state: z.enum(["draft", "needs_grading", "graded"]),
        version: z.number(),
        objective_points: z.number().nullable(),
      })
      .parse(
        await this.rpc("learning_save_attempt", {
          target_attempt: id,
          target_release: release,
          target_quiz: quiz,
          responses: answers,
          submit,
          expected_version: version,
        }),
      );
  }
  async grade(
    id: string,
    marks: Record<string, number>,
    feedback: string,
    revision: number,
  ) {
    await this.rpc("learning_grade_written", {
      target_attempt: id,
      marks,
      feedback_text: feedback,
      expected_revision: revision,
    });
  }
  async reviewCompletion(
    release: string,
    item: string,
    decision: "approved" | "needs_repeat",
    version: number,
  ) {
    await this.rpc("learning_review_completion", {
      target_release: release,
      item,
      decision,
      expected_version: version,
    });
  }
  async complete(release: string, item: string) {
    await this.rpc("learning_complete", { target_release: release, item });
  }
  async media(path: string) {
    const { data, error } = await this.client.storage
      .from("training-media")
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl)
      throw Error(error?.message || "Media is unavailable.");
    return data.signedUrl;
  }
}
