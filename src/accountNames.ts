import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeAccountName(value: string): string | null {
  // Count Unicode code points, matching PostgreSQL char_length.
  const name = value.replace(/^ +| +$/g, "");
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name) || [...name].length > 100)
    throw new Error(
      "Use up to 100 characters without control characters or line breaks.",
    );
  return name || null;
}
const nameState = z.object({
  display_name: z.string().nullable(),
  version: z.number().int().nonnegative(),
  eligible: z.boolean(),
});
export type AccountNameState = z.infer<typeof nameState>;
export async function loadAccountName(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_my_account_name");
  if (error)
    throw new Error("Your name could not be loaded. Reconnect and retry.");
  return nameState.parse(data);
}
export async function saveAccountName(
  client: SupabaseClient,
  value: string,
  version: number,
  userId: string,
) {
  const displayName = normalizeAccountName(value);
  const { data, error } = await client.rpc("save_my_account_name", {
    new_display_name: displayName,
    expected_version: version,
    expected_user_id: userId,
  });
  if (error)
    throw new Error(
      "Your name was not confirmed saved. Reload your name before trying again; another session may have changed it.",
    );
  return nameState.parse(data);
}
