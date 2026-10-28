/** Server-only operational mail. No client content-ready emails or signup trigger. */
export type StaffJob = {
  id: string;
  kind: "training_overdue" | "review_overdue" | "interest_received";
  recipient_email: string;
  lease_token: string;
  idempotency_key: string;
};
export type SendResult = {
  outcome: "accepted" | "retry" | "failed" | "uncertain";
  code: string;
  providerId?: string;
  retryAfter?: number;
};
export type StaffNotificationBackend = {
  observe(limit: number): Promise<number>;
  prepare(limit: number): Promise<number>;
  claim(limit: number): Promise<StaffJob[]>;
  authorize(job: StaffJob): Promise<boolean>;
  finish(
    job: StaffJob,
    result: SendResult | { outcome: "suppressed"; code: string },
  ): Promise<void>;
};
export const STAFF_MAIL_FROM = "Repformed <notifications@repformed.com>";
export const STAFF_MAIL_INBOX = "Repformed@gmail.com";
export const STAFF_WORKSPACE = "https://repformed.com/#workspace";
function validStaffJob(value: unknown): value is StaffJob {
  if (!value || typeof value !== "object") return false;
  const j = value as StaffJob;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return (
    ["training_overdue", "review_overdue", "interest_received"].includes(
      j.kind,
    ) &&
    typeof j.id === "string" &&
    uuid.test(j.id) &&
    typeof j.lease_token === "string" &&
    uuid.test(j.lease_token) &&
    typeof j.recipient_email === "string" &&
    j.recipient_email.toLowerCase() === STAFF_MAIL_INBOX.toLowerCase() &&
    j.idempotency_key === `repformed-staff/${j.id}/v1`
  );
}
/** Exactly one submitted-interest job; never prepares/drains other staff alerts. */
export async function attemptInterestAlert(
  id: string,
  backend: Pick<StaffNotificationBackend, "authorize" | "finish"> & {
    claimInterest(id: string): Promise<StaffJob | null>;
  },
  send: (job: StaffJob) => Promise<SendResult>,
) {
  const job = await backend.claimInterest(id);
  if (!job) return;
  if (!validStaffJob(job) || job.kind !== "interest_received")
    throw new Error("Interest alert not confirmed.");
  if (!(await backend.authorize(job))) {
    await backend.finish(job, {
      outcome: "suppressed",
      code: "eligibility_changed",
    });
    return;
  }
  await backend.finish(job, await send(job));
}
export function staffEmail(job: StaffJob) {
  return {
    from: STAFF_MAIL_FROM,
    to: [job.recipient_email],
    subject:
      job.kind === "interest_received"
        ? "Repformed: new package interest"
        : job.kind === "training_overdue"
          ? "Repformed: training delivery needs attention"
          : "Repformed: a coaching review needs attention",
    text: `${job.kind === "interest_received" ? "A new adult interest request is saved for staff review." : `A required ${job.kind === "training_overdue" ? "training delivery" : "coaching review"} has passed its target.`} Sign in to your staff workspace to check the current status and next action.\n\n${STAFF_WORKSPACE}\n\nThis operational alert contains no contact details, athlete information or media links. Alerts currently route only to the Repformed business inbox.`,
  };
}
/** Transport is injected in tests. Provider acceptance is NOT inbox delivery. */
export function resendStaffSender(
  key: string,
  transport: typeof fetch = fetch,
) {
  return async (job: StaffJob): Promise<SendResult> => {
    if (job.recipient_email.toLowerCase() !== STAFF_MAIL_INBOX.toLowerCase())
      return { outcome: "failed", code: "recipient_policy" };
    try {
      const response = await transport("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": job.idempotency_key,
        },
        body: JSON.stringify(staffEmail(job)),
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        const body = await response.json().catch(() => null);
        return body &&
          typeof body.id === "string" &&
          /^[a-zA-Z0-9_-]{1,100}$/.test(body.id)
          ? {
              outcome: "accepted",
              code: "provider_accepted",
              providerId: body.id,
            }
          : { outcome: "retry", code: "provider_response_uncertain" };
      }
      // Never persist/return provider response bodies: they may include addresses.
      if (response.status === 409)
        return { outcome: "uncertain", code: "idempotency_conflict" };
      if (response.status === 429 || response.status >= 500) {
        const seconds = Number(response.headers.get("retry-after"));
        return {
          outcome: "retry",
          code:
            response.status === 429
              ? "provider_rate_limited"
              : "provider_unavailable",
          retryAfter:
            Number.isFinite(seconds) && seconds > 0
              ? Math.max(60, Math.min(3600, Math.ceil(seconds)))
              : 60,
        };
      }
      return {
        outcome: "failed",
        code:
          response.status === 401 || response.status === 403
            ? "provider_configuration"
            : "provider_rejected",
      };
    } catch {
      // A timeout may mean accepted-but-response-lost. Stable payload/key + the
      // database's 23-hour limit protect retries within Resend's 24-hour window.
      return { outcome: "retry", code: "provider_response_uncertain" };
    }
  };
}
function equalSecret(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let different = 0;
  for (let i = 0; i < actual.length; i++)
    different |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return different === 0;
}
export function staffNotificationHandler(options: {
  serviceToken: string;
  backend: StaffNotificationBackend;
  emailMode: "disabled" | "resend";
  send: ((job: StaffJob) => Promise<SendResult>) | null;
}) {
  const json = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json(405, { error: "post_required" });
    const bearer = request.headers.get("authorization") || "";
    if (
      !options.serviceToken ||
      !equalSecret(bearer, `Bearer ${options.serviceToken}`)
    )
      return json(401, { error: "server_authorization_required" });
    const raw = await request.text();
    if (raw.length > 1024) return json(400, { error: "invalid_batch" });
    let body: { limit?: number };
    try {
      body = raw ? JSON.parse(raw) : {};
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => key !== "limit") ||
        (body.limit !== undefined &&
          (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 10))
      )
        throw new Error();
    } catch {
      return json(400, { error: "invalid_batch" });
    }
    const limit = body.limit ?? 10;
    try {
      // In-app observation is separately default-off in the database. No client
      // email is created by this path, regardless of email mode or package flags.
      const inapp = await options.backend.observe(limit);
      if (options.emailMode !== "resend" || !options.send)
        return json(200, {
          inapp_observed: inapp,
          email: "disabled",
          signup: "interest_submission",
          external_sends: 0,
        });
      const prepared = await options.backend.prepare(limit);
      const jobs = await options.backend.claim(limit);
      if (
        !Array.isArray(jobs) ||
        jobs.length > limit ||
        jobs.some((job) => !validStaffJob(job))
      )
        throw new Error();
      let accepted = 0,
        failed = 0,
        suppressed = 0;
      for (const job of jobs) {
        if (!(await options.backend.authorize(job))) {
          await options.backend.finish(job, {
            outcome: "suppressed",
            code: "eligibility_changed",
          });
          suppressed++;
          continue;
        }
        const result = await options.send(job);
        // Failed persistence returns an error; the same lease/job/key is retained
        // for safe reconciliation. No success is invented after a lost result.
        await options.backend.finish(job, result);
        if (result.outcome === "accepted") accepted++;
        else failed++;
      }
      return json(200, {
        inapp_observed: inapp,
        prepared,
        provider_accepted: accepted,
        pending_or_failed: failed,
        suppressed,
        signup: "interest_submission",
        delivery_confirmed: false,
      });
    } catch {
      return json(503, { error: "dispatch_not_confirmed" });
    }
  };
}
