import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const invitationRole = z.enum(["manager", "coach", "parent", "athlete"]);
const invitationState = z.enum([
  "preparing",
  "sent",
  "failed",
  "accepted",
  "cancelled",
  "expired",
]);
const inviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  intended_role: invitationRole,
  state: invitationState,
  delivery_code: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string(),
  version: z.number().int(),
});
export type AccountInvitation = z.infer<typeof inviteSchema>;
export type InvitationRole = z.infer<typeof invitationRole>;
const pendingSchema = z.object({
  id: z.string().uuid(),
  intended_role: invitationRole,
  state: invitationState,
  expires_at: z.string(),
});
export type PendingInvitation = z.infer<typeof pendingSchema>;
const closureSchema = z.object({
  eligible: z.boolean(),
  reason: z.string(),
  request_id: z.string().uuid().nullable(),
  state: z.enum([
    "none",
    "cleaning",
    "failed",
    "completed",
    "assistance_requested",
    "assistance_reviewed",
  ]),
  profile_count: z.number().int().nonnegative(),
  video_count: z.number().int().nonnegative(),
});
export type AccountClosureState = z.infer<typeof closureSchema>;
const helpSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  state: z.string(),
  reason: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ClosureHelpRequest = z.infer<typeof helpSchema>;

async function checkedRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await client.rpc(name, args);
  if (error)
    throw new Error(
      "The account request was not confirmed. Reconnect and refresh before retrying.",
    );
  return data;
}
async function trustedAction(
  client: SupabaseClient,
  body: Record<string, unknown>,
  token?: string,
) {
  const { data, error } = await client.functions.invoke("account-lifecycle", {
    body,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  if (error) {
    let detail =
      "The account service did not confirm the request. Reconnect and retry. No email delivery or deletion is implied.";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const parsed = z
          .object({ error: z.string().max(600) })
          .safeParse(await context.json());
        if (parsed.success) detail = parsed.data.error;
      } catch {
        /* Retain a neutral message for malformed/offline responses. */
      }
    }
    throw new Error(detail);
  }
  return data;
}
export class AccountLifecycle {
  constructor(readonly client: SupabaseClient) {}
  async invitations() {
    return z
      .array(inviteSchema)
      .parse(await checkedRpc(this.client, "list_account_invitations"));
  }
  async invite(requestId: string, email: string, role: InvitationRole) {
    return z
      .object({
        invitation: z.object({
          id: z.string().uuid(),
          state: invitationState,
          delivery_code: z.string().optional(),
        }),
      })
      .parse(
        await trustedAction(this.client, {
          action: "invite",
          requestId,
          email: email.trim().toLowerCase(),
          role,
        }),
      );
  }
  async cancel(invite: AccountInvitation) {
    await checkedRpc(this.client, "cancel_account_invitation", {
      invitation: invite.id,
      expected_version: invite.version,
    });
  }
  async pending() {
    return pendingSchema
      .nullable()
      .parse(await checkedRpc(this.client, "my_account_invitation"));
  }
  async accept(id: string) {
    await checkedRpc(this.client, "accept_account_invitation", {
      invitation: id,
      adult_confirmed: true,
      privacy_acknowledged: true,
    });
  }
  async closure() {
    return closureSchema.parse(
      await checkedRpc(this.client, "account_lifecycle_state"),
    );
  }
  async requestHelp() {
    return z
      .string()
      .uuid()
      .parse(await checkedRpc(this.client, "request_account_closure_help"));
  }
  async helpRequests() {
    return z
      .array(helpSchema)
      .parse(await checkedRpc(this.client, "list_account_closure_requests"));
  }
  async reviewHelp(id: string) {
    await checkedRpc(this.client, "review_account_closure_request", {
      request_id: id,
    });
  }
  async deleteAccount(
    requestId: string,
    expectedUserId: string,
    email: string,
    password: string,
  ) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (
      error ||
      data.user?.id !== expectedUserId ||
      !data.session?.access_token
    )
      throw new Error(
        "Your current password was not confirmed for this account. Nothing has been submitted for deletion by this attempt.",
      );
    const result = z
      .object({
        deleted: z.literal(true),
        requestId: z.string().uuid(),
        receiptSaved: z.boolean(),
      })
      .parse(
        await trustedAction(
          this.client,
          { action: "delete", requestId, confirmation: "DELETE" },
          data.session.access_token,
        ),
      );
    return result;
  }
}
export const closureReason = (reason: string) =>
  reason === "owner_transfer"
    ? "Your Owner access must be transferred or reviewed before this account can close. Your platform will not be deleted from this screen."
    : reason === "staff_content"
      ? "Staff access and any training content need an ownership review before this account can close."
      : "Guardian-managed access needs a verified review before this account can close. This does not open junior enrollment.";
