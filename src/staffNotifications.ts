import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
export const staffMailSchema = z.object({
  email_enabled: z.boolean(),
  inapp_observation_enabled: z.boolean(),
  signup_status: z.literal("interest_submission"),
  routing_mode: z.literal("shared_inbox"),
  recipient_label: z.literal("Repformed@gmail.com"),
  jobs: z.array(
    z.object({
      id: z.string().uuid(),
      kind: z.enum(["training_overdue", "review_overdue", "interest_received"]),
      profile_id: z.string().uuid().nullable(),
      athlete_name: z.string(),
      state: z.enum([
        "queued",
        "processing",
        "retry",
        "accepted",
        "failed",
        "suppressed",
        "uncertain",
      ]),
      attempts: z.number().int(),
      due_at: z.string(),
      updated_at: z.string(),
      code: z.string().nullable(),
      provider_id: z.string().nullable(),
    }),
  ),
});
export type StaffMailState = z.infer<typeof staffMailSchema>;
export const STAFF_MAIL_STATUS: Record<
  StaffMailState["jobs"][number]["state"],
  string
> = {
  queued: "Queued",
  processing: "Attempt started · result pending",
  retry: "Waiting for safe retry",
  accepted: "Provider accepted · inbox delivery not confirmed",
  failed: "Failed · staff follow-up needed",
  suppressed: "Stopped · eligibility or access changed",
  uncertain: "Outcome uncertain · reconcile before resending",
};
export class StaffNotifications {
  constructor(readonly client: SupabaseClient) {}
  async load() {
    const { data, error } = await this.client.rpc(
      "staff_notification_workspace",
    );
    if (error)
      throw new Error(
        error.message || "Staff email status could not be loaded.",
      );
    return staffMailSchema.parse(data);
  }
}
