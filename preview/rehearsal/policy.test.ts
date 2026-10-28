import { describe, it, expect, vi } from "vitest";
import {
  TEST_REF,
  TEST_URL,
  publicTestKey,
  testFetch,
  syntheticAccount,
  samplePath,
  learnerKeysAbsent,
  receiptJson,
  type Receipt,
} from "./policy";
function jwt(role: string, ref = TEST_REF) {
  return (
    "header." +
    btoa(JSON.stringify({ role, ref })).replace(/=/g, "") +
    ".signature"
  );
}
describe("isolated real-service harness boundaries", () => {
  it("accepts public test configuration while rejecting secret, user and other-project keys without echo", () => {
    expect(publicTestKey("sb_publishable_fixture_only_123456")).toBe(
      "sb_publishable_fixture_only_123456",
    );
    expect(publicTestKey(jwt("anon"))).toBe(jwt("anon"));
    for (const value of [
      jwt("service_role"),
      jwt("authenticated"),
      jwt("anon", "otherproject"),
      "sb_secret_fixture_value",
      "bad",
    ])
      expect(() => publicTestKey(value)).toThrow(
        /public publishable\/anon key/,
      );
  });
  it("keeps six reserved fictional accounts and synthetic UUID text paths only", () => {
    expect(syntheticAccount("repformed-learning-parent@example.test")).toBe(
      true,
    );
    expect(syntheticAccount("real@example.com")).toBe(false);
    const id = "91000000-0000-4000-8000-000000000001";
    expect(samplePath(`${id}/${id}/${id}.txt`)).toBe(true);
    expect(samplePath(`${id}/../../private.mp4`)).toBe(false);
  });
  it("forbids production, management, Auth admin, functions and signed URLs on unrelated hosts", async () => {
    const native = vi.fn<typeof fetch>(async () => new Response("{}"));
    const request = testFetch(native);
    for (const url of [
      "https://iilbulpqbuknhdpmtrvm.supabase.co/rest/v1/player_profiles",
      "https://api.supabase.com/v1/projects",
      TEST_URL + "/auth/v1/admin/users",
      TEST_URL + "/functions/v1/interest-intake",
      "https://example.com/asset",
    ])
      await expect(request(url)).rejects.toThrow(/Only the approved/);
    expect(native).not.toHaveBeenCalled();
    await request(TEST_URL + "/rest/v1/rpc/learning_athlete", {
      method: "POST",
      body: "{}",
    });
    await request(TEST_URL + "/auth/v1/token?grant_type=password");
    expect(native).toHaveBeenCalledTimes(2);
    expect(native.mock.calls[0][1]).toMatchObject({
      cache: "no-store",
      credentials: "omit",
    });
  });
  it("detects answer-key fields without rejecting normal grades and saved responses", () => {
    expect(
      learnerKeysAbsent({
        enrollments: [
          {
            releases: [
              {
                quizzes: [{ questions: [{ id: "sample_1", points: 1 }] }],
                attempts: [{ answers: { sample_1: 0 }, objective_points: 1 }],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
    expect(
      learnerKeysAbsent({ quizzes: [{ questions: [{ correct: 0 }] }] }),
    ).toBe(false);
  });
  it("exports a strict allowlist instead of serializing auth/media/content objects", () => {
    const row = {
      check: "raw keys",
      role: "parent",
      result: "passed",
      at: "2026-10-28T00:00:00Z",
      password: "never-export",
      access_token: "never-export",
      signedUrl: "never-export",
      answers: "never-export",
    } as Receipt;
    const json = receiptJson([row]);
    expect(json).not.toContain("never-export");
    expect(JSON.parse(json).checks[0]).toEqual({
      check: "raw keys",
      role: "parent",
      result: "passed",
      at: "2026-10-28T00:00:00Z",
    });
  });
});
