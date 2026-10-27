import { it, expect } from "vitest";
import {
  draftDeliveryRule as r,
  effectiveDeliveryRule,
  localDeliveryInstant,
  testEmailAdapter,
  deliveryRuleSchema,
} from "./deliveryRules";
it("applies package then client then athlete precedence without mutating defaults", () => {
  expect(
    effectiveDeliveryRule(
      r,
      { time: "09:00", grace_minutes: 30 },
      { grace_minutes: 15 },
    ),
  ).toMatchObject({
    time: "09:00",
    grace_minutes: 15,
    timezone: "America/Chicago",
  });
  expect(r.time).toBe("08:00");
});
it("resolves exact local boundaries across DST and rejects ambiguous/skipped hours", () => {
  expect(localDeliveryInstant("2026-10-25", r).toISOString()).toBe(
    "2026-10-25T13:00:00.000Z",
  );
  expect(localDeliveryInstant("2026-11-01", r).toISOString()).toBe(
    "2026-11-01T14:00:00.000Z",
  );
  expect(() =>
    localDeliveryInstant("2026-11-01", { ...r, time: "01:30" }),
  ).toThrow("skipped or repeated");
  expect(() =>
    localDeliveryInstant("2026-03-08", { ...r, time: "02:30" }),
  ).toThrow("skipped or repeated");
  expect(() => localDeliveryInstant("2026-10-26", r)).toThrow("due day");
  expect(() => localDeliveryInstant("2026-02-30", r)).toThrow();
});
it("does not allow client-directed overdue routing or active submission reminders", () => {
  expect(() => deliveryRuleSchema.parse({ ...r, routing: "parent" })).toThrow();
  expect(() =>
    deliveryRuleSchema.parse({ ...r, submission_reminders: true }),
  ).toThrow();
  expect(() => deliveryRuleSchema.parse({ ...r, timezone: "" })).toThrow();
  expect(
    deliveryRuleSchema.parse({
      ...r,
      submission_expectation: "One assigned practice clip",
      submission_cadence_hours: 48,
    }).submission_reminders,
  ).toBe(false);
  expect(() =>
    deliveryRuleSchema.parse({ ...r, submission_cadence_hours: 0 }),
  ).toThrow();
});
it("distinguishes disabled and simulated email outcomes without sending", async () => {
  expect(await testEmailAdapter("disabled")).toEqual({
    status: "disabled",
    external_send: false,
  });
  expect(await testEmailAdapter("test", "failed")).toEqual({
    status: "failed",
    external_send: false,
    simulated: true,
  });
  expect(await testEmailAdapter("test", "sent")).toEqual({
    status: "sent",
    external_send: false,
    simulated: true,
  });
});
