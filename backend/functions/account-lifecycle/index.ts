// Deployed only to the dedicated Supabase Edge runtime, never bundled in Vite.
// Runtime Auth/Storage credentials are Supabase's server-owned built-in secrets.
// No service key is requested from the user or returned to the browser.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { lifecycleHandler, type LifecycleBackend } from "./handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const redirectTo = "https://repformed.com/";
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
const backend: LifecycleBackend = {
  async verifyUser(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user || !data.user.email) return null;
    // Decode only AFTER Auth has cryptographically verified this exact token.
    let passwordAuthenticatedAt: number | null = null;
    try {
      const segment = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(segment));
      if (claims.sub !== data.user.id) return null;
      const times = Array.isArray(claims.amr)
        ? claims.amr
            .filter(
              (a: { method?: string; timestamp?: number }) =>
                a?.method === "password" && typeof a.timestamp === "number",
            )
            .map((a: { timestamp: number }) => a.timestamp)
        : [];
      if (times.length) passwordAuthenticatedAt = Math.max(...times);
    } catch {
      return null;
    }
    return {
      id: data.user.id,
      email: data.user.email,
      emailConfirmed: Boolean(data.user.email_confirmed_at),
      passwordAuthenticatedAt,
    };
  },
  reserveInvitation: (actor, id, email, role) =>
    rpc("begin_account_invitation", {
      actor,
      invitation: id,
      target_email: email,
      target_role: role,
    }),
  async deliverInvitation(email) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });
    if (error) {
      const message = error.message.toLowerCase();
      const code =
        message.includes("already") &&
        (message.includes("registered") || message.includes("exists"))
          ? "account_exists"
          : message.includes("smtp") ||
              message.includes("not authorized") ||
              message.includes("email address") ||
              message.includes("email rate")
            ? "mail_setup_required"
            : "delivery_unconfirmed";
      return { userId: null, code };
    }
    return {
      userId: data.user?.id || null,
      code: data.user ? "sent" : "delivery_unconfirmed",
    };
  },
  finishInvitation: (id, userId, code) =>
    rpc("finish_account_invitation", {
      invitation: id,
      recipient: userId,
      result_code: code,
    }),
  beginClosure: (userId, requestId) =>
    rpc("begin_account_closure", { target: userId, request_id: requestId }),
  closureMedia: (userId) => rpc("account_closure_media", { target: userId }),
  async removeVideos(paths) {
    const { error } = await admin.storage
      .from("athlete-review-videos")
      .remove(paths);
    if (error) throw new Error("Private media removal was not confirmed.");
  },
  clearClosureData: (userId, requestId) =>
    rpc("clear_account_closure_data", {
      target: userId,
      request_id: requestId,
    }),
  async deleteAuthUser(userId) {
    const { error } = await admin.auth.admin.deleteUser(userId, false);
    if (error) throw new Error("Authentication erasure was not confirmed.");
  },
  finishClosure: (requestId, failed) =>
    rpc("finish_account_closure", { request_id: requestId, failed }),
};
Deno.serve(lifecycleHandler(backend));
