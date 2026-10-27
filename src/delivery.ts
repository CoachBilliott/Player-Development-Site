import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliveryRuleSchema } from "./deliveryRules";
export const packageSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  rule: deliveryRuleSchema,
  version: z.number(),
});
const alertSchema = z.object({
  state: z.enum(["open", "acknowledged", "resolved"]),
  escalated_at: z.string().nullable(),
  episode: z.number(),
});
export const deliveryWorkspaceSchema = z.object({
  manual_only: z.literal(true),
  email_adapter: z.literal("disabled"),
  enabled: z.boolean(),
  packages: z.array(packageSchema),
  client: z
    .object({
      package_id: z.string().uuid(),
      overrides: deliveryRuleSchema.partial(),
      version: z.number(),
      state: z.enum(["active", "paused", "cancelled"]),
    })
    .nullable(),
  athlete: z
    .object({
      overrides: deliveryRuleSchema.partial(),
      state: z.enum(["active", "paused", "cancelled"]),
      version: z.number(),
    })
    .nullable(),
  effective_rule: deliveryRuleSchema.nullable(),
  checks: z.array(
    z.object({
      id: z.string().uuid(),
      cycle_key: z.string(),
      due_at: z.string(),
      notice_not_before: z.string(),
      rule_snapshot: deliveryRuleSchema,
      state: z.enum(["active", "paused", "cancelled"]),
      last_checked_at: z.string().nullable(),
      first_observed_available_at: z.string().nullable(),
      available_now: z.boolean(),
      alert: alertSchema.nullable(),
    }),
  ),
});
export const deliveryQueueSchema = z.array(
  z.object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    athlete_name: z.string(),
    cycle_key: z.string(),
    due_at: z.string(),
    timezone: z.string(),
    last_checked_at: z.string().nullable(),
    state: z.enum(["open", "acknowledged"]),
    escalated_at: z.string().nullable(),
    episode: z.number(),
    available_now: z.boolean(),
  }),
);
export const contentNoticesSchema = z.array(
  z.object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    kind: z.enum(["training_ready", "review_ready"]),
    athlete_name: z.string().optional(),
    observed_at: z.string(),
    read_at: z.string().nullable(),
    email_status: z.literal("disabled"),
    available_now: z.boolean(),
  }),
);
export type DeliveryWorkspace = z.infer<typeof deliveryWorkspaceSchema>;
export type DeliveryQueue = z.infer<typeof deliveryQueueSchema>;
export type ContentNotice = z.infer<typeof contentNoticesSchema>[number];
export class DeliveryService {
  constructor(readonly client: SupabaseClient) {}
  private async call(name: string, body?: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, body);
    if (error)
      throw new Error(
        error.message ||
          "Delivery settings could not be confirmed. Refresh and retry.",
      );
    return data;
  }
  async workspace(profile: string) {
    return deliveryWorkspaceSchema.parse(
      await this.call("delivery_profile_workspace", {
        target_profile: profile,
      }),
    );
  }
  async queue() {
    return deliveryQueueSchema.parse(await this.call("delivery_staff_queue"));
  }
  async evaluate(profile: string) {
    await this.call("evaluate_delivery_checks", { target_profile: profile });
  }
  async acknowledge(id: string) {
    await this.call("acknowledge_delivery_alert", { check_id: id });
  }
  async savePackage(id: string, title: string, rule: unknown, version: number) {
    await this.call("save_delivery_package", {
      package_id: id,
      title,
      rule,
      expected_version: version,
    });
  }
  async saveOverride(
    profile: string,
    scope: "client" | "athlete",
    pkg: string | null,
    overrides: unknown,
    state: string,
    version: number,
  ) {
    await this.call("save_delivery_override", {
      target_profile: profile,
      scope,
      package_id: pkg,
      overrides,
      state,
      expected_version: version,
    });
  }
  async plan(
    id: string,
    profile: string,
    cycle: string,
    workout: string,
    version: number,
    date: string,
    boundary: string,
  ) {
    await this.call("plan_delivery_check", {
      check_id: id,
      target_profile: profile,
      cycle_key: cycle,
      workout,
      workout_version: version,
      local_date: date,
      notice_not_before: boundary,
    });
  }
  async checkState(id: string, state: string, previous: string) {
    await this.call("set_delivery_check_state", {
      check_id: id,
      state,
      expected_state: previous,
    });
  }
  async inbox() {
    return contentNoticesSchema.parse(await this.call("my_content_notices"));
  }
  async read(id: string) {
    await this.call("read_content_notice", { notice_id: id });
  }
}
