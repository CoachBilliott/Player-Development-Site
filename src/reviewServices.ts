import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
export const serviceSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  video_id: z.string().uuid().nullable(),
  assigned_to: z.string().uuid().nullable(),
  drill_title: z.string(),
  state: z.enum([
    "requested",
    "uploading",
    "pending_parent",
    "queued",
    "in_review",
    "delivered",
    "cancelled",
  ]),
  funding: z.literal("manual_pilot"),
  blocker: z.enum([
    "none",
    "access_needed",
    "customer_follow_up",
    "technical_issue",
  ]),
  ready_at: z.string().nullable(),
  due_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int().positive(),
  is_grouped: z.boolean().optional(),
  group_erased: z.boolean().optional(),
  clip_count: z.number().int().optional(),
  uploaded_clips: z.number().int().optional(),
});
export type ReviewService = z.infer<typeof serviceSchema>;
export const SERVICE_LABELS: Record<ReviewService["state"], string> = {
  requested: "Request received",
  uploading: "Waiting for complete video",
  pending_parent: "Parent approval needed",
  queued: "Ready for coach",
  in_review: "Coach reviewing",
  delivered: "Feedback ready",
  cancelled: "Cancelled",
};
export const BLOCKERS = {
  none: "No follow-up needed",
  access_needed: "Review access needed",
  customer_follow_up: "Customer follow-up needed",
  technical_issue: "Upload or technical help needed",
} as const;
export const deskSchema = z.object({
  requests: z.array(serviceSchema),
  staff: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      role: z.enum(["owner", "manager", "coach"]),
    }),
  ),
});
export type ReviewDesk = z.infer<typeof deskSchema>;
export function reviewTiming(row: ReviewService, now: number) {
  if (row.state === "cancelled") return "Request closed";
  if (row.state === "delivered")
    return row.delivered_at &&
      row.due_at &&
      Date.parse(row.delivered_at) > Date.parse(row.due_at)
      ? "Delivered after target"
      : "Delivered";
  if (!row.due_at)
    return "48-hour clock starts after video submission and required approval";
  const remaining = Date.parse(row.due_at) - now;
  return remaining <= 0
    ? "Overdue — follow up now"
    : remaining <= 12 * 3600000
      ? "Due soon — within 12 hours"
      : "On track";
}
export function reviewDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
export class ReviewServices {
  constructor(readonly client: SupabaseClient) {}
  async desk() {
    const { data, error } = await this.client.rpc("review_service_desk");
    if (error)
      throw new Error(
        "Service tracking could not be loaded. Reconnect and refresh.",
      );
    return deskSchema.parse(data);
  }
  async request(id: string, profile: string) {
    const { data, error } = await this.client.rpc("request_drill_review", {
      request_id: id,
      target_profile: profile,
    });
    if (error)
      throw new Error(
        "Your request was not confirmed. Refresh and retry; no payment was taken.",
      );
    return serviceSchema.parse(data);
  }
  async cancel(row: ReviewService) {
    const { error } = await this.client.rpc("cancel_drill_review", {
      request_id: row.id,
      expected_version: row.version,
    });
    if (error)
      throw new Error("This request changed. Refresh before cancelling.");
  }
  async manage(
    row: ReviewService,
    coach: string,
    blocker: ReviewService["blocker"],
  ) {
    const { error } = await this.client.rpc("manage_review_service", {
      request_id: row.id,
      coach: coach || null,
      blocker_code: blocker,
      expected_version: row.version,
    });
    if (error)
      throw new Error(
        "This request or staff access changed. Refresh before saving.",
      );
  }
}
