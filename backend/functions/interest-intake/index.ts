// REVIEW DRAFT. Public HTTP deployment/JWT exemption requires specific approval.
// The existing staff dispatcher must keep its separate JWT/server-only gate.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { interestIntakeHandler, type IntakeResult } from "./handler.ts";
import {
  attemptInterestAlert,
  resendStaffSender,
  type StaffJob,
  type SendResult,
} from "../staff-notifications/handler.ts";
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
declare const EdgeRuntime: { waitUntil(work: Promise<unknown>): void };
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error("Interest alert not confirmed.");
  return data as T;
}
const key = Deno.env.get("REPFORMED_RESEND_API_KEY");
const sender =
  key && Deno.env.get("STAFF_NOTIFICATION_EMAIL_MODE") === "resend"
    ? resendStaffSender(key)
    : null;
async function notify(id: string) {
  if (!sender) return;
  await attemptInterestAlert(
    id,
    {
      claimInterest: (request_id) =>
        rpc<StaffJob | null>("claim_interest_notification", { request_id }),
      authorize: (job) =>
        rpc<boolean>("authorize_staff_notification_job", {
          job_id: job.id,
          lease: job.lease_token,
        }),
      finish: (
        job,
        result: SendResult | { outcome: "suppressed"; code: string },
      ) =>
        rpc<void>("finish_staff_notification_job", {
          job_id: job.id,
          lease: job.lease_token,
          outcome: result.outcome,
          result_code: result.code,
          provider_reference:
            "providerId" in result ? result.providerId || null : null,
          retry_after_seconds:
            "retryAfter" in result ? result.retryAfter || 60 : 60,
        }),
    },
    sender,
  );
}
Deno.serve(
  interestIntakeHandler({
    enabled: Deno.env.get("INTEREST_INTAKE_MODE") === "enabled",
    notify,
    defer:
      typeof EdgeRuntime !== "undefined"
        ? (work) => EdgeRuntime.waitUntil(work)
        : undefined,
    backend: {
      async accept(input) {
        const { data, error } = await admin.rpc("accept_public_interest", {
          submission_id: input.id,
          adult_name: input.name,
          adult_email: input.email,
          package_interest: input.packageInterest,
          adult_confirmed: input.adult,
          launch_updates: input.launchUpdates,
          consent_version: input.launchNoticeVersion,
        });
        if (
          error ||
          !data ||
          !["accepted", "disabled", "rate_limited", "conflict"].includes(
            data.status,
          )
        )
          throw new Error("Interest receipt unconfirmed.");
        if (
          data.status === "accepted" &&
          (typeof data.dispatch_id !== "string" ||
            !/^[0-9a-f-]{36}$/i.test(data.dispatch_id))
        )
          throw new Error("Interest receipt unconfirmed.");
        return {
          status: data.status,
          dispatchId: data.dispatch_id,
        } as IntakeResult;
      },
    },
  }),
);
