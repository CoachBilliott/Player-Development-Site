import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AGES, GOALS, LEVELS, POSITIONS } from "./model";

export const accountSchema = z.object({
  user_id: z.string().uuid(),
  account_type: z.enum(["parent", "adult"]),
  privacy_version: z.string(),
});
export const playerInputSchema = z
  .object({
    nickname: z.string().trim().min(1, "Enter a nickname.").max(40),
    age_group: z.enum(AGES),
    sport: z.literal("football"),
    position: z.enum(POSITIONS),
    experience: z.enum(LEVELS),
    goal: z.enum(GOALS),
    guardian_confirmed: z.boolean(),
  })
  .refine((p) => p.age_group === "18+" || p.guardian_confirmed, {
    message: "A parent or legal guardian must manage every under-18 player.",
  });
export const playerSchema = z
  .object({
    id: z.string().uuid(),
    owner_id: z.string().uuid(),
    version: z.number().int().positive(),
  })
  .and(playerInputSchema);
export type MemberAccount = z.infer<typeof accountSchema>;
export type PlayerInput = z.infer<typeof playerInputSchema>;
export type PrivatePlayer = z.infer<typeof playerSchema>;
const columns =
  "id,owner_id,nickname,age_group,sport,position,experience,goal,guardian_confirmed,version";
export class Accounts {
  constructor(readonly client: SupabaseClient) {}
  async load() {
    const account = await this.client
      .from("member_accounts")
      .select("user_id,account_type,privacy_version")
      .maybeSingle();
    if (account.error)
      throw new Error(
        "Your account could not be loaded. Reconnect and try again.",
      );
    const settings = await this.client
      .from("profile_settings")
      .select("under18_enabled")
      .single();
    if (settings.error)
      throw new Error(
        "Enrollment settings could not be verified. Please retry online.",
      );
    const under18Enabled = z
      .object({ under18_enabled: z.boolean() })
      .parse(settings.data).under18_enabled;
    if (!account.data) return { account: null, players: [], under18Enabled };
    const parsed = accountSchema.parse(account.data);
    const profiles = await this.client
      .from("player_profiles")
      .select(columns)
      .order("created_at");
    if (profiles.error)
      throw new Error(
        "Private profiles could not be loaded. Your saved profiles have not been changed.",
      );
    return {
      account: parsed,
      players: z.array(playerSchema).parse(profiles.data),
      under18Enabled,
    };
  }
  async setup(kind: "parent" | "adult") {
    const { data, error } = await this.client.rpc("complete_member_account", {
      kind,
      adult_confirmed: true,
      privacy_acknowledged: true,
    });
    if (error)
      throw new Error(
        "Account setup was not confirmed. Verify your email and retry. No demo players will be imported.",
      );
    return accountSchema.parse(data);
  }
  async save(id: string, input: PlayerInput, version?: number) {
    const value = playerInputSchema.parse(input);
    const query = version
      ? this.client
          .from("player_profiles")
          .update(value)
          .eq("id", id)
          .eq("version", version)
      : this.client.from("player_profiles").insert({ id, ...value });
    const { data, error } = await query.select(columns).maybeSingle();
    if (error || !data) {
      // A lost response can occur after commit. Confirm the stable ID/version
      // before allowing a retry, without creating a duplicate player.
      const check = await this.client
        .from("player_profiles")
        .select(columns)
        .eq("id", id)
        .maybeSingle();
      const parsed = playerSchema.safeParse(check.data);
      if (
        parsed.success &&
        parsed.data.version === (version ? version + 1 : 1) &&
        Object.entries(value).every(
          ([key, entry]) => parsed.data[key as keyof PrivatePlayer] === entry,
        )
      )
        return parsed.data;
      throw new Error(
        "Save was not confirmed, or this player changed on another device. Your draft is still here. Cancel and refresh profiles before retrying.",
      );
    }
    return playerSchema.parse(data);
  }
  async remove(player: PrivatePlayer) {
    const { data, error } = await this.client
      .from("player_profiles")
      .delete()
      .eq("id", player.id)
      .eq("version", player.version)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error(
        "Removal was not confirmed. Refresh profiles before retrying.",
      );
  }
  async deleteData() {
    const { error } = await this.client.rpc("delete_member_data");
    if (error)
      throw new Error("Deletion was not confirmed. Reconnect and try again.");
  }
}
export function authRedirect(recovery = false) {
  const url = new URL(window.location.href);
  url.search = "";
  if (recovery) url.searchParams.set("flow", "recovery");
  url.hash = "account";
  return url.href;
}
