import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
export const weeklyRulePatchSchema = z
  .object({
    friday_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    reminders_enabled: z.boolean().optional(),
    low_ready_weeks: z.number().int().min(1).max(8).optional(),
  })
  .strict();
export type WeeklyRulePatch = z.infer<typeof weeklyRulePatchSchema>;
const defaults = z.object({
  friday_time: z.string(),
  reminders_enabled: z.boolean(),
  low_ready_weeks: z.number().int().min(1).max(8),
});
export const weeklyNotificationWorkspaceSchema = z.object({
  profile_id: z.string().uuid(),
  global: defaults,
  runtime: z.object({
    learning_enabled: z.boolean(),
    scheduler_enabled: z.boolean(),
    notices_enabled: z.boolean(),
  }),
  packages: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      rules: weeklyRulePatchSchema,
      version: z.number().int().positive(),
    }),
  ),
  client: z
    .object({
      package_id: z.string().uuid(),
      rules: weeklyRulePatchSchema,
      version: z.number().int().positive(),
    })
    .nullable(),
  athlete: z
    .object({
      package_id: z.string().uuid().nullable(),
      rules: weeklyRulePatchSchema,
      version: z.number().int().positive(),
    })
    .nullable(),
  effective: defaults.extend({
    timezone: z.literal("America/Chicago"),
    training_notices: z.boolean(),
    staff_routing: z.enum(["assigned_coach", "owners_managers"]),
  }),
});
export type WeeklyNotificationWorkspace = z.infer<
  typeof weeklyNotificationWorkspaceSchema
>;
export type WeeklyRuleScope = "package" | "client" | "athlete";
export class WeeklyNotificationService {
  constructor(readonly client: SupabaseClient) {}
  async workspace(profile: string) {
    if (!z.string().uuid().safeParse(profile).success)
      throw Error("Choose an athlete first.");
    const { data, error } = await this.client.rpc(
      "learning_notification_workspace",
      { target_profile: profile },
    );
    if (error?.code === "PGRST202") return null;
    if (error)
      throw Error(
        "Weekly notification settings could not be loaded. Your access or connection may have changed.",
      );
    const result = weeklyNotificationWorkspaceSchema.safeParse(data);
    if (!result.success || result.data.profile_id !== profile)
      throw Error(
        "Weekly notification settings were not confirmed for this athlete. Refresh and retry.",
      );
    return result.data;
  }
  async save(
    scope: WeeklyRuleScope,
    profile: string,
    packageId: string | null,
    patch: WeeklyRulePatch,
    version: number,
    athletePackage: string | null,
  ) {
    if (
      !z.enum(["package", "client", "athlete"]).safeParse(scope).success ||
      (scope === "package" ? packageId === null : packageId !== null) ||
      (scope !== "athlete" && athletePackage !== null)
    )
      throw Error("Choose an unambiguous weekly settings scope.");
    const parsed = weeklyRulePatchSchema.safeParse(patch);
    if (
      !parsed.success ||
      !Number.isInteger(version) ||
      version < 0 ||
      !z.string().uuid().safeParse(profile).success ||
      (packageId !== null && !z.string().uuid().safeParse(packageId).success) ||
      (athletePackage !== null &&
        !z.string().uuid().safeParse(athletePackage).success)
    )
      throw Error("Choose valid weekly notification settings before saving.");
    const { error } = await this.client.rpc("learning_save_notification_rule", {
      target_scope: scope,
      target_profile: scope === "package" ? null : profile,
      target_package: scope === "package" ? packageId : null,
      rule_patch: parsed.data,
      expected_version: version,
      selected_weekly_package: scope === "athlete" ? athletePackage : null,
    });
    if (error)
      throw Error(
        error.message ||
          "The change was not confirmed. Keep your draft and retry or refresh.",
      );
  }
}
