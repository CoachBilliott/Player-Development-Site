import { describe, expect, it } from "vitest";
import {
  chicagoInstant,
  nextSunday,
  fridayReminder,
  reminderIsDue,
  sundayStart,
} from "./schedule";
describe("Chicago weekly release clock", () => {
  it.each([
    ["2026-03-08", "2026-03-08T06:00:00.000Z"],
    ["2026-03-15", "2026-03-15T05:00:00.000Z"],
    ["2026-11-01", "2026-11-01T05:00:00.000Z"],
    ["2026-11-08", "2026-11-08T06:00:00.000Z"],
  ])("releases %s at local midnight across DST", (day, utc) =>
    expect(chicagoInstant(day, "00:00").toISOString()).toBe(utc),
  );
  it("starts an enrollment next Sunday, never the prior Sunday", () => {
    expect(nextSunday(new Date("2026-10-28T19:00Z")).toISOString()).toBe(
      "2026-11-01T05:00:00.000Z",
    );
    expect(nextSunday(new Date("2026-11-01T05:00Z")).toISOString()).toBe(
      "2026-11-08T06:00:00.000Z",
    );
    expect(sundayStart(new Date("2026-11-01T04:59Z")).toISOString()).toBe(
      "2026-10-25T05:00:00.000Z",
    );
  });
  it("places Friday reminder at configurable local clock", () => {
    expect(fridayReminder(new Date("2026-11-01T05:00Z")).toISOString()).toBe(
      "2026-11-06T23:00:00.000Z",
    );
    expect(fridayReminder(new Date("2026-03-08T06:00Z")).toISOString()).toBe(
      "2026-03-13T22:00:00.000Z",
    );
  });
  it("does not backfill reminders after Friday, or remind finished/paused/inactive/notified athletes", () => {
    const base = {
      now: new Date("2026-11-06T23:01Z"),
      releasedAt: new Date("2026-11-01T05:00Z"),
      paused: false,
      accessActive: true,
      learnerDone: false,
      alreadyNotified: false,
    };
    expect(reminderIsDue(base)).toBe(true);
    for (const patch of [
      { paused: true },
      { accessActive: false },
      { learnerDone: true },
      { alreadyNotified: true },
      { now: new Date("2026-11-07T06:00Z") },
      { now: new Date("2026-11-05T23:00Z") },
    ])
      expect(reminderIsDue({ ...base, ...patch })).toBe(false);
  });
  it("rejects invalid dates and nonexistent DST clocks", () => {
    expect(() => chicagoInstant("2026-02-30", "00:00")).toThrow();
    expect(() => chicagoInstant("2026-03-08", "02:30")).toThrow();
  });
});
