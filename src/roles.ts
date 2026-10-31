import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
export const ROLES = [
  "owner",
  "manager",
  "coach",
  "parent",
  "athlete",
] as const;
export type AccountRole = (typeof ROLES)[number];
export const ROLE_LABELS: Record<AccountRole, string> = {
  owner: "Owner",
  manager: "Manager",
  coach: "Coach",
  parent: "Parent",
  athlete: "Athlete",
};
export const ROLE_DETAILS: Record<AccountRole, string> = {
  owner: "Manage account levels and all shared training content.",
  manager: "Manage shared training content across the team.",
  coach: "Publish and manage your own training resources.",
  parent:
    "Add family athletes, control self-recording and review their workouts.",
  athlete:
    "Your individual athlete profile, on its own or connected to a family.",
};
export const accessSchema = z.object({
  role: z.enum(ROLES),
  version: z.number().int().positive(),
});
export const accessMemberSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string(),
  display_name: z.string().nullable().optional(),
  role: z.enum(ROLES).nullable(),
  version: z.number().int().nonnegative(),
  email_verified: z.boolean(),
  adult_setup: z.boolean(),
});
export type AccessMember = z.infer<typeof accessMemberSchema>;
export const isStaff = (role: AccountRole | null) =>
  role === "owner" || role === "manager" || role === "coach";
export function listAccess(client: SupabaseClient, search: string) {
  return readAccess(client, search, "list_account_access");
}
export function listNamedAccess(client: SupabaseClient, search: string) {
  return readAccess(client, search, "list_account_access_v2");
}
async function readAccess(client: SupabaseClient, search: string, rpc: string) {
  const { data, error } = await client.rpc(rpc, {
    search_text: search.trim(),
  });
  if (error)
    throw new Error(
      "Account access could not be loaded. Owner access is required; reconnect and retry.",
    );
  return z.array(accessMemberSchema).parse(data);
}
export async function assignRole(
  client: SupabaseClient,
  member: AccessMember,
  role: AccountRole,
) {
  const { error } = await client.rpc("assign_account_role", {
    target_user: member.user_id,
    new_role: role,
    expected_version: member.version,
  });
  if (error)
    throw new Error(
      "Access change was not confirmed. Verify this person completed adult setup; Athlete access is for one individual profile; family-linked athletes must stay Athlete. Refresh if another owner changed the account. Your own Owner access is protected.",
    );
}
