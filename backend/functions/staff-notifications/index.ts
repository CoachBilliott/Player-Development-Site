// Separate app-dispatch key only; never reads Supabase Auth SMTP credentials.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  staffNotificationHandler,
  resendStaffSender,
  type StaffNotificationBackend,
} from "./handler.ts";
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const token = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, token, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error)
    throw new Error("Operational notification state could not be confirmed.");
  return data as T;
}
const backend: StaffNotificationBackend = {
  observe: (limit) =>
    rpc("observe_new_content_notices", { batch_limit: limit }),
  prepare: (limit) =>
    rpc("prepare_staff_notification_jobs", { batch_limit: limit }),
  claim: (limit) =>
    rpc("claim_staff_notification_jobs", { batch_limit: limit }),
  authorize: (job) =>
    rpc("authorize_staff_notification_job", {
      job_id: job.id,
      lease: job.lease_token,
    }),
  finish: (job, result) =>
    rpc("finish_staff_notification_job", {
      job_id: job.id,
      lease: job.lease_token,
      outcome: result.outcome,
      result_code: result.code,
      provider_reference:
        "providerId" in result ? result.providerId || null : null,
      retry_after_seconds:
        "retryAfter" in result ? result.retryAfter || 60 : 60,
    }),
};
const key = Deno.env.get("REPFORMED_RESEND_API_KEY");
const enabled =
  Deno.env.get("STAFF_NOTIFICATION_EMAIL_MODE") === "resend" && Boolean(key);
Deno.serve(
  staffNotificationHandler({
    serviceToken: token,
    backend,
    emailMode: enabled ? "resend" : "disabled",
    send: enabled ? resendStaffSender(key!) : null,
  }),
);
