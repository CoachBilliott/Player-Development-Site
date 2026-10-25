import { expect, it } from "vitest";
import { reviewTiming, type ReviewService } from "./reviewServices";
const now = Date.parse("2026-10-25T12:00:00Z");
const base = {
  state: "queued",
  due_at: "2026-10-27T12:00:00Z",
  delivered_at: null,
} as ReviewService;
it("48-hour targets distinguish on-track, due-soon, exact-deadline and overdue work", () => {
  expect(reviewTiming(base, now)).toBe("On track");
  expect(
    reviewTiming(
      { ...base, due_at: new Date(now + 12 * 3600000).toISOString() },
      now,
    ),
  ).toContain("Due soon");
  expect(
    reviewTiming({ ...base, due_at: new Date(now).toISOString() }, now),
  ).toContain("Overdue");
  expect(
    reviewTiming({ ...base, due_at: new Date(now - 1).toISOString() }, now),
  ).toContain("Overdue");
});
it("waiting requests have no running clock and delivered work retains late delivery evidence", () => {
  expect(
    reviewTiming({ ...base, due_at: null, state: "pending_parent" }, now),
  ).toContain("starts after");
  expect(reviewTiming({ ...base, state: "cancelled" }, now)).toBe(
    "Request closed",
  );
  expect(
    reviewTiming(
      { ...base, state: "delivered", delivered_at: "2026-10-27T12:00:00Z" },
      now,
    ),
  ).toBe("Delivered");
  expect(
    reviewTiming(
      { ...base, state: "delivered", delivered_at: "2026-10-27T12:00:01Z" },
      now,
    ),
  ).toBe("Delivered after target");
});
