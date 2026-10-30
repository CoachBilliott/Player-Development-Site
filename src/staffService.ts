import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceSchema } from "./reviewServices";
export const learningServiceSchema = z.object({
  enabled: z.literal(true),
  enrollment_id: z.string().nullable(),
  plan_id: z.string().optional(),
  title: z.string().nullable(),
  status: z.enum([
    "not_enrolled",
    "access_inactive",
    "paused",
    "needs_grading",
    "pending_parent",
    "content_withdrawn",
    "needs_content",
    "awaiting_release",
    "plan_complete",
    "week_complete",
    "ready",
  ]),
  enrollment_state: z.string().optional(),
  access_active: z.boolean().optional(),
  current_week: z.number().nullable().optional(),
  current_title: z.string().nullable().optional(),
  current_release_id: z.string().nullable().optional(),
  available_at: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  next_week: z.number().optional(),
  next_release_at: z.string().nullable().optional(),
  ready_weeks: z.number(),
  total_weeks: z.number().optional(),
  pending_grades: z.number(),
  pending_parent: z.number(),
  last_reported_at: z.string().nullable().optional(),
});
export const rosterCursorSchema = z.object({
  priority: z.number().int().min(0).max(2),
  label: z.string(),
  key: z.string(),
});
export type RosterCursor = z.infer<typeof rosterCursorSchema>;
export type RosterFilters = {
  query: string;
  filter: string;
  age: string;
  position: string;
  coach: string;
};
export const staffAthleteSchema = z.object({
  client_id: z.string().uuid(),
  client_label: z.string(),
  athlete_id: z.string().uuid().nullable(),
  athlete_name: z.string().nullable(),
  age_group: z.string().optional(),
  position: z.string().optional(),
  experience: z.string().optional(),
  goal: z.string().optional(),
  coach_id: z.string().uuid().nullable().optional(),
  coach_label: z.string().nullable().optional(),
  coach_version: z.number().optional(),
  workout_id: z.string().uuid().nullable().optional(),
  workout_title: z.string().optional(),
  workout_version: z.number().nullable().optional(),
  assignment_updated_at: z.string().nullable().optional(),
  eligible_access: z.boolean().optional(),
  media_ready: z.boolean().optional(),
  resources: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        version: z.number(),
        minutes: z.coerce.number(),
        review_stage: z.string(),
        reviewed_by: z.string().nullable(),
        reviewed_at: z.string().nullable(),
        upload_received: z.boolean(),
      }),
    )
    .default([]),
  scheduled_at: z.string().nullable().optional(),
  release_timezone: z.string().nullable().optional(),
  first_available_at: z.string().nullable().optional(),
  schedule_tracking_available: z.boolean().optional(),
  observed_at: z.string().optional(),
  last_opened_at: z.string().nullable().optional(),
  open_tracking_available: z.boolean().optional(),
  last_practice_saved_at: z.string().nullable().optional(),
  last_completion_at: z.string().nullable().optional(),
  pending_reviews: z.number().optional(),
  overdue_reviews: z.number().optional(),
  blocked_reviews: z.number().optional(),
  review_scope: z.string().optional(),
  review_tasks: z.array(serviceSchema).default([]),
  purchase: z.null().optional(),
  payment_tracking_available: z.boolean().optional(),
  notification_status: z.string().nullable().optional(),
  notification_tracking_available: z.boolean().optional(),
  next_action: z.string(),
  learning: learningServiceSchema.optional(),
});
export type StaffAthlete = z.infer<typeof staffAthleteSchema>;
export const rosterSchema = z.object({
  source: z.literal("account_backend"),
  scope: z.enum(["assigned_athletes", "all_repformed_clients"]),
  rows: z.array(staffAthleteSchema),
  coaches: z.array(z.object({ id: z.string().uuid(), label: z.string() })),
  page: z
    .object({
      total: z.number(),
      matched: z.number(),
      athletes: z.number(),
      clients: z.number(),
      counts: z.object({
        overdue: z.number(),
        attention: z.number(),
        ready: z.number(),
      }),
      ages: z.array(z.string()),
      positions: z.array(z.string()),
      next_cursor: rosterCursorSchema.nullable(),
    })
    .optional(),
});
export type ServiceRoster = z.infer<typeof rosterSchema>;
export const rosterPageInput = z.object({
  search: z.string().trim().max(160),
  status: z.enum(["all", "overdue", "blocked", "ready", "unassigned"]),
  age: z.string().max(80),
  position: z.string().max(80),
  coach: z.union([z.literal(""), z.literal("none"), z.string().uuid()]),
  number: z.number().int().min(1).max(1000000),
  size: z.number().int().min(1).max(100),
});
export type RosterPageInput = z.infer<typeof rosterPageInput>;
const count = z.number().int().nonnegative();
export const rosterPageSchema = rosterSchema
  .extend({
    page: z.object({
      number: z.number().int().positive(),
      size: z.number().int().min(1).max(100),
      pages: z.number().int().positive(),
      total: count,
      matched: count,
      athletes: count,
      clients: count,
      counts: z.object({ overdue: count, attention: count, ready: count }),
      ages: z.array(z.string()),
      positions: z.array(z.string()),
      coaches: z.array(z.object({ id: z.string().uuid(), label: z.string() })),
    }),
  })
  .refine(
    ({ rows, page }) =>
      page.number <= page.pages &&
      page.matched <= page.total &&
      page.pages === Math.max(1, Math.ceil(page.matched / page.size)) &&
      rows.length ===
        Math.min(
          page.size,
          Math.max(0, page.matched - (page.number - 1) * page.size),
        ),
    "The roster page response is inconsistent. Refresh before continuing.",
  );
export type ServiceRosterPage = z.infer<typeof rosterPageSchema>;
export class StaffService {
  constructor(readonly client: SupabaseClient) {}
  async roster(signal?: AbortSignal) {
    const request = this.client.rpc("staff_client_service_roster");
    const { data, error } = await (signal
      ? request.abortSignal(signal)
      : request);
    if (error)
      throw new Error(
        "Client service records could not be loaded. The reviewed dashboard migration and connection are required.",
      );
    return rosterSchema.parse(data);
  }
  async page(
    filters: RosterFilters,
    cursor: RosterCursor | null = null,
    size = 25,
    signal?: AbortSignal,
  ) {
    const request = this.client.rpc("staff_learning_roster_page", {
      search_text: filters.query,
      status_filter: filters.filter,
      age_filter: filters.age,
      position_filter: filters.position,
      coach_filter: filters.coach,
      after_cursor: cursor,
      page_size: size,
    });
    const { data, error } = await (signal
      ? request.abortSignal(signal)
      : request);
    if (error)
      throw Error(
        "Weekly service records could not be loaded. Retry or check the reviewed learning connection.",
      );
    const value = rosterSchema.parse(data);
    if (!value.page) throw Error("The paged learning service is unavailable.");
    return value;
  }
  async athlete(id: string) {
    const { data, error } = await this.client.rpc("staff_athlete_service", {
      target_profile: id,
    });
    if (error)
      throw new Error(
        "This athlete is outside your service roster or access changed. Refresh your workspace.",
      );
    return staffAthleteSchema.parse(data);
  }
  async rosterPage(input: RosterPageInput, signal: AbortSignal) {
    const parsed = rosterPageInput.safeParse(input);
    if (!parsed.success)
      throw new Error(
        "Choose valid roster filters and a page size from 1 to 100.",
      );
    const p = parsed.data;
    const { data, error } = await this.client
      .rpc("staff_client_service_roster_page", {
        search_text: p.search,
        status_filter: p.status,
        age_filter: p.age,
        position_filter: p.position,
        coach_filter: p.coach,
        page_number: p.number,
        page_size: p.size,
      })
      .abortSignal(signal);
    // A missing capability supports staged rollout/rollback. An authorization
    // failure, malformed response or other server error must NEVER fall back.
    if (error?.code === "PGRST202") return this.roster(signal);
    if (error)
      throw new Error(
        "The roster page could not be loaded. Reconnect and refresh; your filters are preserved.",
      );
    const result = rosterPageSchema.safeParse(data);
    if (!result.success)
      throw new Error(
        "The roster response could not be verified. Refresh before continuing.",
      );
    return result.data;
  }
  async assign(profile: string, coach: string | null, version: number) {
    const { error } = await this.client.rpc("assign_athlete_service_coach", {
      target_profile: profile,
      coach,
      expected_version: version,
    });
    if (error)
      throw new Error(
        "Coach assignment was not confirmed. Refresh before retrying.",
      );
  }
}
