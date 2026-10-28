import { expect, it, vi } from "vitest";
import {
  staffNotificationHandler,
  resendStaffSender,
  staffEmail,
  type StaffJob,
  type StaffNotificationBackend,
} from "../backend/functions/staff-notifications/handler";
const job: StaffJob = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "training_overdue",
  recipient_email: "fictional-staff@example.test",
  lease_token: "00000000-0000-4000-8000-000000000002",
  idempotency_key: "repformed-staff/00000000-0000-4000-8000-000000000001/v1",
};
function setup(mode: "disabled" | "resend" = "resend") {
  const backend: StaffNotificationBackend = {
    observe: vi.fn(async () => 1),
    prepare: vi.fn(async () => 1),
    claim: vi.fn(async () => [job]),
    authorize: vi.fn(async () => true),
    finish: vi.fn(async () => {}),
  };
  const send = vi.fn(async () => ({
    outcome: "accepted" as const,
    code: "provider_accepted",
    providerId: "provider_1",
  }));
  const handler = staffNotificationHandler({
    backend,
    serviceToken: "synthetic-server-only",
    emailMode: mode,
    send,
  });
  const request = (body = "{}", token = "synthetic-server-only") =>
    new Request("https://example.test/function", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body,
    });
  return { backend, send, handler, request };
}
it("denies member tokens and arbitrary recipients/actions, including malformed batch bodies", async () => {
  const f = setup();
  expect((await f.handler(f.request("{}", "member-token"))).status).toBe(401);
  for (const body of [
    '{"to":"child@example.test"}',
    '{"kind":"signup"}',
    "null",
    "5",
    "[]",
    '{"limit":11}',
    '{"limit":0}',
  ])
    expect((await f.handler(f.request(body))).status).toBe(400);
  expect(f.send).not.toHaveBeenCalled();
  expect(f.backend.observe).not.toHaveBeenCalled();
});
it("disabled email mode observes only in-app eligibility and never claims/transports mail", async () => {
  const f = setup("disabled");
  const r = await f.handler(f.request());
  expect(await r.json()).toMatchObject({
    email: "disabled",
    signup: "unconfigured",
    external_sends: 0,
  });
  expect(f.send).not.toHaveBeenCalled();
  expect(f.backend.claim).not.toHaveBeenCalled();
});
it("rechecks current access immediately before transport and suppresses revoked jobs", async () => {
  const f = setup();
  vi.mocked(f.backend.authorize).mockResolvedValue(false);
  const r = await f.handler(f.request());
  expect(await r.json()).toMatchObject({ suppressed: 1, provider_accepted: 0 });
  expect(f.send).not.toHaveBeenCalled();
  expect(f.backend.finish).toHaveBeenCalledWith(job, {
    outcome: "suppressed",
    code: "eligibility_changed",
  });
});
it("does not call provider acceptance delivery, return recipients, or pretend a failed record saved", async () => {
  const f = setup();
  const r = await f.handler(f.request());
  const value = await r.json();
  expect(value).toMatchObject({
    provider_accepted: 1,
    delivery_confirmed: false,
  });
  expect(JSON.stringify(value)).not.toContain("example.test");
  vi.mocked(f.backend.finish).mockRejectedValue(
    new Error("private provider details"),
  );
  const failed = await f.handler(f.request());
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("private provider");
});
it("uses fixed generic staff templates with no athlete or video details", () => {
  expect(staffEmail(job)).toMatchObject({
    from: "Repformed <notifications@repformed.com>",
    to: ["fictional-staff@example.test"],
  });
  expect(staffEmail(job).text).toContain("https://repformed.com/#workspace");
  expect(staffEmail(job).text).not.toContain(job.id);
  expect(staffEmail({ ...job, kind: "review_overdue" }).subject).toContain(
    "coaching review",
  );
});
it("sends identical frozen payload and Resend idempotency key across response-loss retries", async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValueOnce(Response.json({ id: "provider_1" }));
  const send = resendStaffSender("synthetic-key", transport);
  expect(await send(job)).toMatchObject({
    outcome: "retry",
    code: "provider_response_uncertain",
  });
  expect(await send(job)).toMatchObject({
    outcome: "accepted",
    providerId: "provider_1",
  });
  const first = transport.mock.calls[0][1]!,
    second = transport.mock.calls[1][1]!;
  expect(first.body).toEqual(second.body);
  expect(first.headers).toEqual(second.headers);
  expect(first.headers).toMatchObject({
    "Idempotency-Key": job.idempotency_key,
  });
});
it("handles rate limits, provider failure and conflicting idempotency without storing raw error bodies", async () => {
  for (const [status, outcome, code] of [
    [429, "retry", "provider_rate_limited"],
    [503, "retry", "provider_unavailable"],
    [403, "failed", "provider_configuration"],
    [422, "failed", "provider_rejected"],
    [409, "uncertain", "idempotency_conflict"],
  ] as const) {
    const send = resendStaffSender(
      "synthetic-key",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("private recipient", {
          status,
          headers: { "retry-after": "120" },
        }),
      ),
    );
    const result = await send(job);
    expect(result).toMatchObject({ outcome, code });
    expect(JSON.stringify(result)).not.toContain("private recipient");
    if (status === 429) expect(result.retryAfter).toBe(120);
  }
});
it("does not report success after an invalid provider response", async () => {
  const send = resendStaffSender(
    "synthetic-key",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ something: "else" })),
  );
  expect(await send(job)).toMatchObject({
    outcome: "retry",
    code: "provider_response_uncertain",
  });
});

it("rejects invalid claimed jobs before any provider request", async () => {
  for (const invalid of [
    { ...job, kind: "new_signup" },
    {
      ...job,
      recipient_email: "staff@example.test\r\nBcc: child@example.test",
    },
    { ...job, idempotency_key: "different-key" },
  ]) {
    const f = setup();
    vi.mocked(f.backend.claim).mockResolvedValue([invalid as StaffJob]);
    expect((await f.handler(f.request())).status).toBe(503);
    expect(f.send).not.toHaveBeenCalled();
  }
});
it("uses a conservative retry floor even when the provider offers an immediate retry", async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "1" },
      }),
    );
  expect(
    await resendStaffSender("synthetic-key", transport)(job),
  ).toMatchObject({ outcome: "retry", retryAfter: 60 });
});
