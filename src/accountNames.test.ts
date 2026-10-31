import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completeStaffAccountSetup,
  STAFF_PRIVACY_VERSION,
  normalizeAccountName,
} from "./accountNames";
it("accepts optional names and Unicode without guessing an identity", () => {
  expect(normalizeAccountName("  José 李  ")).toBe("José 李");
  expect(normalizeAccountName("   ")).toBeNull();
  expect(normalizeAccountName("😀".repeat(100))).toBe("😀".repeat(100));
});
it("rejects excessive length, controls and invisible format characters", () => {
  for (const value of [
    "a".repeat(101),
    "A\nB",
    "A\tB",
    "A\u0085B",
    "A\u200fB",
    "A\u2028B",
  ])
    expect(() => normalizeAccountName(value)).toThrow(/100 characters/);
});

it("staff consent helper never sends unchecked or outdated acceptance", async () => {
  const rpc = vi.fn();
  const client = { rpc } as unknown as SupabaseClient;
  for (const [adult, privacy, version] of [
    [false, true, STAFF_PRIVACY_VERSION],
    [true, false, STAFF_PRIVACY_VERSION],
    [true, true, "profile-pilot-2026-10"],
  ] as const)
    await expect(
      completeStaffAccountSetup(
        client,
        "10000000-0000-4000-8000-000000000001",
        1,
        adult,
        privacy,
        version,
      ),
    ).rejects.toThrow(/Accept both adult/);
  expect(rpc).not.toHaveBeenCalled();
});
it("staff consent request binds the mounted identity, exact role version and current human acceptance", async () => {
  const rpc = vi.fn(async () => ({
    data: { eligible: true, display_name: null, version: 0 },
    error: null,
  }));
  const client = { rpc } as unknown as SupabaseClient;
  const user = "10000000-0000-4000-8000-000000000001";
  await completeStaffAccountSetup(
    client,
    user,
    7,
    true,
    true,
    STAFF_PRIVACY_VERSION,
  );
  expect(rpc).toHaveBeenCalledWith("complete_my_staff_account_setup", {
    expected_user_id: user,
    expected_role_version: 7,
    adult_confirmed: true,
    privacy_acknowledged: true,
    accepted_privacy_version: STAFF_PRIVACY_VERSION,
  });
});
