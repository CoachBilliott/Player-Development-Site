import { it, expect, vi } from "vitest";
import {
  interestIntakeHandler,
  type IntakeResult,
} from "../backend/functions/interest-intake/handler";
import { parseInterestSubmission } from "./interestContract";
const input = {
  id: "a0000000-0000-4000-8000-000000000001",
  name: "Fictional Adult",
  email: " ADULT@Example.Test ",
  packageInterest: "undecided",
  adult: true,
  website: "",
  launchUpdates: false,
  launchNoticeVersion: "repformed-launch-notice-v1",
};
function setup(enabled = true, status: IntakeResult["status"] = "accepted") {
  const accept = vi.fn(async () => ({ status }));
  const handler = interestIntakeHandler({ enabled, backend: { accept } });
  const request = (
    body: unknown = input,
    origin = "https://repformed.com",
    method = "POST",
    contentType = "application/json",
  ) =>
    new Request("https://example.test/intake", {
      method,
      headers: { origin, "content-type": contentType },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
  return { accept, handler, request };
}
it("accepts a minimal declared-adult request without an account and returns no contact information", async () => {
  const f = setup();
  const r = await f.handler(f.request());
  expect(r.status).toBe(202);
  expect(await r.json()).toEqual({ status: "accepted", reference: input.id });
  expect(f.accept).toHaveBeenCalledWith({
    ...input,
    email: "adult@example.test",
  });
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(r.headers.get("access-control-allow-origin")).toBe(
    "https://repformed.com",
  );
});
it("has separate disabled and origin/method gates; it is not authenticated signup", async () => {
  const f = setup(false);
  expect((await f.handler(f.request())).status).toBe(503);
  expect(f.accept).not.toHaveBeenCalled();
  const g = setup();
  expect(
    (await g.handler(g.request(input, "https://unrelated.test"))).status,
  ).toBe(403);
  expect(
    (await g.handler(g.request(input, "https://repformed.com", "GET"))).status,
  ).toBe(405);
  expect(
    (await g.handler(g.request(input, "https://repformed.com", "OPTIONS")))
      .status,
  ).toBe(204);
  expect(g.accept).not.toHaveBeenCalled();
});
it("rejects child fields, marketing flags, routing inputs, malformed fields and honeypot content", async () => {
  const f = setup();
  for (const body of [
    { ...input, childName: "Do not store" },
    { ...input, dob: "2015-01-01" },
    { ...input, to: "another@example.test" },
    { ...input, subscribe: true },
    { ...input, adult: false },
    { ...input, email: "invalid" },
    { ...input, name: "x".repeat(61) },
    { ...input, name: "bad\nname" },
    { ...input, website: "bot.example" },
    { ...input, packageInterest: "invented" },
    [],
    null,
  ])
    expect((await f.handler(f.request(body))).status).toBe(400);
  expect(f.accept).not.toHaveBeenCalled();
});
it("bounds streamed request bytes and requires actual JSON media type", async () => {
  const f = setup();
  expect(
    (
      await f.handler(
        f.request(
          input,
          "https://repformed.com",
          "POST",
          "application/json-malicious",
        ),
      )
    ).status,
  ).toBe(400);
  const r = new Request("https://example.test", {
    method: "POST",
    headers: {
      origin: "https://repformed.com",
      "content-type": "application/json",
    },
    body: "x".repeat(4097),
  });
  expect((await f.handler(r)).status).toBe(400);
  expect(f.accept).not.toHaveBeenCalled();
});
it("reports storage failure honestly without leaking database errors or attempting SMTP", async () => {
  const f = setup();
  f.accept.mockRejectedValue(
    new Error("private-contact@example.test SECRET database text"),
  );
  const r = await f.handler(f.request());
  expect(r.status).toBe(503);
  expect(await r.text()).toBe('{"code":"receipt_unconfirmed"}');
});
it("preserves idempotency reference on retries and distinguishes limits/conflicts/disabled intake", async () => {
  const f = setup();
  await f.handler(f.request());
  await f.handler(f.request());
  expect(f.accept.mock.calls[0]).toEqual(f.accept.mock.calls[1]);
  for (const [status, expected] of [
    ["rate_limited", 429],
    ["conflict", 409],
    ["disabled", 503],
  ] as const) {
    const g = setup(true, status);
    expect((await g.handler(g.request())).status).toBe(expected);
  }
});
it("keeps optional names optional and limits packages to current proposals plus undecided", () => {
  expect(parseInterestSubmission({ ...input, name: undefined })?.name).toBe("");
  for (const packageInterest of [
    "undecided",
    "foundation",
    "fundamentals",
    "position-development",
    "elite-coaching",
  ])
    expect(
      parseInterestSubmission({ ...input, packageInterest })?.packageInterest,
    ).toBe(packageInterest);
});
it("records explicit versioned launch preference without inferring consent from old or unchecked requests", async () => {
  const f = setup();
  await f.handler(f.request({ ...input, launchUpdates: true }));
  expect(f.accept).toHaveBeenCalledWith(
    expect.objectContaining({
      launchUpdates: true,
      launchNoticeVersion: "repformed-launch-notice-v1",
    }),
  );
  const legacy = { ...input } as Record<string, unknown>;
  delete legacy.launchUpdates;
  delete legacy.launchNoticeVersion;
  expect(parseInterestSubmission(legacy)).toMatchObject({
    launchUpdates: false,
    launchNoticeVersion: null,
  });
  for (const launchNoticeVersion of [null, undefined, "old-notice"]) {
    expect(
      parseInterestSubmission({
        ...input,
        launchUpdates: true,
        launchNoticeVersion,
      }),
    ).toBeNull();
  }
  expect(parseInterestSubmission(input)?.launchUpdates).toBe(false);
});
it("does not lose an accepted request when its submission-triggered notification fails", async () => {
  const notify = vi.fn(async () => {
    throw new Error("provider unavailable");
  });
  const handler = interestIntakeHandler({
    enabled: true,
    backend: {
      accept: async () => ({ status: "accepted", dispatchId: input.id }),
    },
    notify,
  });
  const r = await handler(setup().request());
  expect(r.status).toBe(202);
  expect(notify).toHaveBeenCalledWith(input.id);
  expect(await r.json()).toEqual({ status: "accepted", reference: input.id });
});
it("defers a persisted request's own notification without exposing internal dispatch identifiers", async () => {
  const internal = "b0000000-0000-4000-8000-000000000002",
    tasks: Promise<unknown>[] = [];
  const notify = vi.fn(async () => undefined);
  const handler = interestIntakeHandler({
    enabled: true,
    backend: {
      accept: async () => ({ status: "accepted", dispatchId: internal }),
    },
    notify,
    defer: (work) => tasks.push(work),
  });
  const r = await handler(setup().request());
  await Promise.all(tasks);
  expect(notify).toHaveBeenCalledWith(internal);
  expect(await r.text()).not.toContain(internal);
});
