import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WeeklyNotificationService,
  type WeeklyNotificationWorkspace,
} from "./notificationRules";
const profile = "91000000-0000-4000-8000-000000000010",
  other = "91000000-0000-4000-8000-000000000011",
  pkg = "91000000-0000-4000-8000-000000000810";
const workspace: WeeklyNotificationWorkspace = {
  profile_id: profile,
  global: { friday_time: "17:00", low_ready_weeks: 2, reminders_enabled: true },
  runtime: {
    learning_enabled: false,
    scheduler_enabled: false,
    notices_enabled: false,
  },
  packages: [],
  client: null,
  athlete: null,
  effective: {
    friday_time: "17:00",
    low_ready_weeks: 2,
    reminders_enabled: true,
    timezone: "America/Chicago",
    staff_routing: "assigned_coach",
    training_notices: true,
  },
};
function service(data: unknown = workspace, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return {
    rpc,
    api: new WeeklyNotificationService({ rpc } as unknown as SupabaseClient),
  };
}
it("treats only a missing capability as unavailable; permission and bad responses fail closed", async () => {
  expect(
    await service(null, { code: "PGRST202" }).api.workspace(profile),
  ).toBeNull();
  await expect(
    service(null, { code: "42501" }).api.workspace(profile),
  ).rejects.toThrow(/could not be loaded/);
  await expect(service([]).api.workspace(profile)).rejects.toThrow(
    /not confirmed/,
  );
  await expect(
    service({ ...workspace, profile_id: other }).api.workspace(profile),
  ).rejects.toThrow(/not confirmed/);
  const { api, rpc } = service();
  expect(await api.workspace(profile)).toEqual(workspace);
  expect(rpc).toHaveBeenCalledWith("learning_notification_workspace", {
    target_profile: profile,
  });
});
it("rejects invalid keys, values, identity and ambiguous scope before network submission", async () => {
  const { api, rpc } = service();
  for (const patch of [
    { friday_time: "24:00" },
    { low_ready_weeks: 0 },
    { role: "owner" },
    { reminders_enabled: "false" },
  ])
    await expect(
      api.save("athlete", profile, null, patch as never, 0, null),
    ).rejects.toThrow(/valid/);
  await expect(
    api.save("athlete", "invalid", null, {}, 0, null),
  ).rejects.toThrow(/valid/);
  await expect(api.save("package", profile, null, {}, 0, null)).rejects.toThrow(
    /scope/,
  );
  await expect(api.save("client", profile, null, {}, 0, pkg)).rejects.toThrow(
    /scope/,
  );
  await expect(
    api.save("unknown" as never, profile, null, {}, 0, null),
  ).rejects.toThrow(/scope/);
  expect(rpc).not.toHaveBeenCalled();
});
it("sends exactly selected scope, athlete and expected version without trusted roles or activation flags", async () => {
  const { api, rpc } = service(null);
  await api.save(
    "athlete",
    profile,
    null,
    { friday_time: "19:00", reminders_enabled: false },
    4,
    pkg,
  );
  expect(rpc).toHaveBeenLastCalledWith("learning_save_notification_rule", {
    target_scope: "athlete",
    target_profile: profile,
    target_package: null,
    rule_patch: { friday_time: "19:00", reminders_enabled: false },
    expected_version: 4,
    selected_weekly_package: pkg,
  });
  await api.save("package", profile, pkg, { low_ready_weeks: 3 }, 2, null);
  expect(rpc).toHaveBeenLastCalledWith("learning_save_notification_rule", {
    target_scope: "package",
    target_profile: null,
    target_package: pkg,
    rule_patch: { low_ready_weeks: 3 },
    expected_version: 2,
    selected_weekly_package: null,
  });
});
it("preserves backend conflict errors so uncertain saves do not pretend success or retry another scope", async () => {
  const { api, rpc } = service(null, {
    message: "Athlete settings changed. Refresh before saving.",
  });
  await expect(
    api.save("athlete", profile, null, { reminders_enabled: false }, 2, null),
  ).rejects.toThrow(/changed/);
  expect(rpc).toHaveBeenCalledTimes(1);
});
