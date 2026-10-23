import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { drillSchema, type Drill } from "./model";
import { validateFile } from "./storage";

const configSchema = z.object({
  enabled: z.boolean(),
  url: z.string(),
  publishableKey: z.string(),
});
export type SharedConfig = { url: string; publishableKey: string };
export function parseSharedConfig(value: unknown): SharedConfig | null {
  const config = configSchema.parse(value);
  if (!config.enabled) return null;
  const url = new URL(config.url);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Use the HTTPS project URL from a separate Supabase project.",
    );
  const key = config.publishableKey;
  if (!key.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") throw new Error();
    } catch {
      throw new Error(
        "Use only a public publishable or anon key. Secret and service-role keys must never be added to the website.",
      );
    }
  }
  return { url: url.origin, publishableKey: key };
}
const rowSchema = z.object({
  id: z.string().uuid(),
  content: drillSchema.omit({
    id: true,
    source: true,
    assetId: true,
    assetType: true,
    assetName: true,
    assetUrl: true,
    backendVersion: true,
  }),
  asset_path: z.string().min(1),
  asset_type: z.string(),
  asset_name: z.string(),
  version: z.number().int().positive(),
});
const columns = "id,content,asset_path,asset_type,asset_name,version";
const bucket = "training-media";
const connections = new Map<string, Promise<SharedContent>>();
export async function connectSharedContent(config: SharedConfig) {
  const existing = connections.get(config.url);
  if (existing) return existing;
  const pending = createConnection(config);
  connections.set(config.url, pending);
  return pending;
}
async function createConnection(config: SharedConfig) {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(config.url, config.publishableKey, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  return new SharedContent(client);
}
let redirectExchange: Promise<void> | undefined;
export function finishAuthRedirect(connection: SharedContent) {
  if (redirectExchange) return redirectExchange;
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has("error") || fragment.has("error")) {
    for (const key of ["error", "error_code", "error_description"])
      url.searchParams.delete(key);
    url.hash = "account";
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return Promise.reject(
      new Error(
        "This email link is invalid or expired. Sign in or request a fresh verification or recovery link.",
      ),
    );
  }
  // Provider-issued email links can use an implicit callback (for invitations
  // and owner activation). Validate the session through Auth before using it,
  // and remove credentials from the address bar before any network request.
  if (fragment.has("access_token")) {
    const access = fragment.get("access_token");
    const refresh = fragment.get("refresh_token");
    const kind = fragment.get("type");
    if (kind === "recovery" || kind === "invite")
      url.searchParams.set("flow", "recovery");
    url.hash = "account";
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    redirectExchange = (async () => {
      if (
        !access ||
        !refresh ||
        !kind ||
        !["signup", "invite", "recovery", "magiclink"].includes(kind)
      )
        throw new Error(
          "This email link is incomplete. Request a fresh sign-in or recovery link.",
        );
      const { error } = await connection.client.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      });
      if (error)
        throw new Error(
          "This email link is invalid or expired. Request a fresh sign-in or recovery link.",
        );
    })();
    return redirectExchange;
  }
  const code = url.searchParams.get("code");
  if (!code) return Promise.resolve();
  redirectExchange = (async () => {
    const { error } = await connection.client.auth.exchangeCodeForSession(code);
    url.searchParams.delete("code");
    url.hash = "account";
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    if (error)
      throw new Error(
        "This email link expired or was opened in a different browser. Sign in or request a fresh link in the browser where you started.",
      );
  })();
  return redirectExchange;
}
export class SharedContent {
  constructor(readonly client: SupabaseClient) {}
  async isCoach() {
    const { data: session } = await this.client.auth.getSession();
    if (!session.session) return false;
    const { data, error } = await this.client
      .from("coach_members")
      .select("user_id")
      .eq("user_id", session.session.user.id)
      .maybeSingle();
    if (error)
      throw new Error(
        "Coach access could not be verified. Check the shared-publishing setup or try again online.",
      );
    return Boolean(data);
  }
  private async requireCoach() {
    if (!(await this.isCoach()))
      throw new Error(
        "Sign in with an approved coach account to change shared content.",
      );
    const { data } = await this.client.auth.getUser();
    if (!data.user)
      throw new Error("Your coach session expired. Sign in again.");
    return data.user;
  }
  private async convert(raw: unknown): Promise<Drill> {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(
        "A shared resource could not be read. Ask its coach to review the content and reconnect before refreshing.",
      );
    const row = parsed.data;
    const { data } = await this.client.storage
      .from(bucket)
      .createSignedUrl(row.asset_path, 3600, {
        download: /^(image|video)\//.test(row.asset_type)
          ? false
          : row.asset_name,
      });
    return {
      ...row.content,
      id: row.id,
      source: "shared",
      assetId: row.asset_path,
      assetType: row.asset_type,
      assetName: row.asset_name,
      backendVersion: row.version,
      ...(data?.signedUrl ? { assetUrl: data.signedUrl } : {}),
    };
  }
  async list() {
    const { data, error } = await this.client
      .from("training_resources")
      .select(columns)
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error)
      throw new Error(
        "Shared resources could not be loaded. Built-in demo drills remain available. Reconnect and refresh to try again.",
      );
    return Promise.all((data || []).map((row) => this.convert(row)));
  }
  private async upload(id: string, file: File, userId: string) {
    const message = validateFile(file);
    if (message) throw new Error(message);
    const extension = (
      {
        "video/mp4": "mp4",
        "video/webm": "webm",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "application/pdf": "pdf",
        "text/plain": "txt",
      } as Record<string, string>
    )[file.type];
    const path = `${userId}/${id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error)
      throw new Error(
        "The shared upload did not finish. Check your connection, file size, and coach access, then retry. Your draft is still here.",
      );
    return path;
  }
  private content(drill: Drill) {
    return drillSchema
      .omit({
        id: true,
        source: true,
        assetId: true,
        assetType: true,
        assetName: true,
        assetUrl: true,
        backendVersion: true,
      })
      .parse(drill);
  }
  async publish(drill: Drill, file: File) {
    const user = await this.requireCoach();
    const content = this.content(drill);
    // A stable draft ID makes retries detectable instead of publishing duplicate resources.
    const existing = await this.client
      .from("training_resources")
      .select(columns)
      .eq("id", drill.id)
      .maybeSingle();
    if (existing.error)
      throw new Error("Could not check the shared draft. Reconnect and retry.");
    if (existing.data)
      throw new Error(
        "This draft was already published. Refresh the shared library and edit the published resource instead.",
      );
    const path = await this.upload(drill.id, file, user.id);
    const { data, error } = await this.client
      .from("training_resources")
      .insert({
        id: drill.id,
        content,
        asset_path: path,
        asset_type: file.type,
        asset_name: file.name,
        status: "published",
      })
      .select(columns)
      .single();
    if (error) {
      // A connection may fail after the server committed. Check before deleting its file.
      const check = await this.client
        .from("training_resources")
        .select(columns)
        .eq("id", drill.id)
        .maybeSingle();
      if (check.data?.asset_path === path) return this.convert(check.data);
      if (!check.error) await this.client.storage.from(bucket).remove([path]);
      throw new Error(
        "Shared publication could not be confirmed. Keep this draft and refresh the shared library before retrying.",
      );
    }
    return this.convert(data);
  }
  async update(drill: Drill, file?: File) {
    const user = await this.requireCoach();
    if (!drill.backendVersion || !drill.assetId)
      throw new Error("Refresh the shared resource before editing.");
    const content = this.content(drill);
    const path = file
      ? await this.upload(drill.id, file, user.id)
      : drill.assetId;
    const { data, error } = await this.client
      .from("training_resources")
      .update({
        content,
        asset_path: path,
        asset_type: file?.type || drill.assetType,
        asset_name: file?.name || drill.assetName,
      })
      .eq("id", drill.id)
      .eq("version", drill.backendVersion)
      .select(columns)
      .maybeSingle();
    if (error || !data) {
      const check = await this.client
        .from("training_resources")
        .select(columns)
        .eq("id", drill.id)
        .maybeSingle();
      const confirmed = rowSchema.safeParse(check.data);
      if (
        confirmed.success &&
        confirmed.data.version === drill.backendVersion + 1 &&
        confirmed.data.asset_path === path &&
        JSON.stringify(confirmed.data.content) === JSON.stringify(content)
      ) {
        if (file)
          await this.client.storage.from(bucket).remove([drill.assetId]);
        return this.convert(confirmed.data);
      }
      if (file && !check.error && check.data?.asset_path !== path)
        await this.client.storage.from(bucket).remove([path]);
      throw new Error(
        "Changes were not confirmed, or another coach changed this resource. Your draft is preserved. Refresh the shared library before trying again.",
      );
    }
    if (file) await this.client.storage.from(bucket).remove([drill.assetId]);
    return this.convert(data);
  }
  async remove(drill: Drill) {
    await this.requireCoach();
    const { data, error } = await this.client
      .from("training_resources")
      .delete()
      .eq("id", drill.id)
      .eq("version", drill.backendVersion)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error(
        "Removal could not be confirmed, or this resource changed. Refresh the shared library before retrying.",
      );
    if (drill.assetId) {
      const cleanup = await this.client.storage
        .from(bucket)
        .remove([drill.assetId]);
      return cleanup.error
        ? "Removed from the library. The old file needs cleanup by the project owner."
        : "";
    }
    return "";
  }
}
