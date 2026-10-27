import { expect, it } from "vitest";
import { releaseTimeReached, sundayReleaseInstant } from "./releaseSchedule";

it("uses the selected Sunday time zone across the autumn clock change", () => {
  expect(
    sundayReleaseInstant(
      "2026-10-25",
      "08:00",
      "America/Chicago",
    ).toISOString(),
  ).toBe("2026-10-25T13:00:00.000Z");
  expect(
    sundayReleaseInstant(
      "2026-11-01",
      "08:00",
      "America/Chicago",
    ).toISOString(),
  ).toBe("2026-11-01T14:00:00.000Z");
  expect(sundayReleaseInstant("2026-11-01", "08:00", "UTC").toISOString()).toBe(
    "2026-11-01T08:00:00.000Z",
  );
});
it("rejects skipped and repeated clock-change times rather than releasing twice or at the wrong hour", () => {
  expect(() =>
    sundayReleaseInstant("2026-03-08", "02:30", "America/Chicago"),
  ).toThrow("does not exist");
  expect(() =>
    sundayReleaseInstant("2026-11-01", "01:30", "America/Chicago"),
  ).toThrow("occurs twice");
});
it("rejects invalid calendar inputs, weekdays, clocks and missing time zones", () => {
  for (const [date, time, zone] of [
    ["2026-02-30", "08:00", "UTC"],
    ["2026-10-26", "08:00", "UTC"],
    ["2026-10-25", "24:00", "UTC"],
    ["2026-10-25", "08:00", ""],
    ["2026-10-25", "08:00", "Not/AZone"],
  ])
    expect(() => sundayReleaseInstant(date, time, zone)).toThrow();
});
it("does not open a release before its exact instant and rejects invalid dates", () => {
  const release = sundayReleaseInstant(
    "2026-11-01",
    "08:00",
    "America/Chicago",
  );
  expect(
    releaseTimeReached(new Date("2026-11-01T13:59:59.999Z"), release),
  ).toBe(false);
  expect(releaseTimeReached(new Date("2026-11-01T14:00:00Z"), release)).toBe(
    true,
  );
  expect(() => releaseTimeReached(new Date("invalid"), release)).toThrow();
});
