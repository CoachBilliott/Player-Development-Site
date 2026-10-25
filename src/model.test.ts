import { describe, expect, it } from "vitest";
import {
  AGES,
  EMPTY,
  GOALS,
  LEVELS,
  POSITIONS,
  PROFILES,
  completeRun,
  filterDrills,
  matches,
  planFor,
  stateSchema,
  type Run,
} from "./model";
import { DRILLS } from "./data";
import { validateFile } from "./storage";
describe("age-aware matching", () => {
  it("provides an eligible, goal-first plan for every supported age, position, level and goal", () => {
    for (const age of AGES)
      for (const position of POSITIONS)
        for (const level of LEVELS)
          for (const goal of GOALS) {
            const p = { ...PROFILES[0], age, position, level, goal };
            const plan = planFor(p, DRILLS);
            expect(plan.length).toBe(age === "5–7" ? 2 : 3);
            expect(plan[0].skill).toBe(goal);
            for (const d of plan) {
              expect(d.ages).toContain(age);
              expect(d.levels).toContain(level);
              expect(
                d.positions.length === 0 || d.positions.includes(position),
              ).toBe(true);
            }
          }
  });
  it("keeps the youngest plans short and separate from older activities", () => {
    const plan = planFor(PROFILES[0], DRILLS);
    expect(plan.every((d) => d.ages.length === 1 && d.ages[0] === "5–7")).toBe(
      true,
    );
    expect(plan.reduce((n, d) => n + d.minutes, 0)).toBe(6);
  });
  it("matches coach resources on all four audience attributes", () => {
    const d = { ...DRILLS[0], positions: ["Explore all positions" as const] };
    expect(matches(d, PROFILES[0])).toBe(true);
    for (const p of PROFILES.slice(1)) expect(matches(d, p)).toBe(false);
    expect(matches({ ...d, skill: "Footwork" }, PROFILES[0])).toBe(false);
  });
});
describe("practice records", () => {
  const run: Run = {
    id: "unique-session",
    profileId: "jordan",
    drillIds: ["tracking"],
    index: 0,
    phase: "done",
  };
  const state = { ...EMPTY, profile: PROFILES[1], run };
  it("records a completed session once, even after repeated completion requests", () => {
    const next = completeRun(state, run, DRILLS, "Still practicing");
    expect(next.history).toHaveLength(1);
    expect(next.history[0].titles).toEqual(["Track the soft ball"]);
    expect(next.history[0].minutes).toBe(4);
    expect(next.run).toBeNull();
    expect(
      completeRun(next, run, DRILLS, "Felt comfortable").history,
    ).toHaveLength(1);
  });
  it("does not record lesson viewing or practice in progress", () => {
    expect(
      completeRun(
        state,
        { ...run, phase: "lesson" },
        DRILLS,
        "Prefer not to say",
      ),
    ).toBe(state);
    expect(
      completeRun(
        state,
        { ...run, phase: "practice" },
        DRILLS,
        "Prefer not to say",
      ),
    ).toBe(state);
  });
  it("rejects another player or missing content", () => {
    expect(
      completeRun(
        state,
        { ...run, profileId: "avery" },
        DRILLS,
        "Prefer not to say",
      ),
    ).toBe(state);
    expect(
      completeRun(
        state,
        { ...run, drillIds: ["missing"] },
        DRILLS,
        "Prefer not to say",
      ),
    ).toBe(state);
  });
});
describe("library and uploads", () => {
  it("combines query, age, position, level, and skill filters", () => {
    const result = filterDrills(DRILLS, {
      query: "  QUARTERBACK ",
      age: "13–17",
      position: "Quarterback",
      level: "Building fundamentals",
      skill: "Footwork",
    });
    expect(result.map((d) => d.id)).toEqual(["qb-reset"]);
  });
  it("returns no results for incompatible filters", () => {
    expect(
      filterDrills(DRILLS, {
        query: "",
        age: "5–7",
        position: "",
        level: "",
        skill: "not-a-skill",
      }),
    ).toEqual([]);
  });
  it("accepts supported files and rejects empty, oversized, and executable files", () => {
    expect(validateFile({ type: "video/mp4", size: 100 })).toBe("");
    expect(validateFile({ type: "text/html", size: 100 })).not.toBe("");
    expect(validateFile({ type: "image/png", size: 0 })).not.toBe("");
    expect(
      validateFile({ type: "text/plain", size: 41 * 1024 * 1024 }),
    ).not.toBe("");
  });
  it("rejects corrupt persisted data instead of trusting its shape", () => {
    expect(stateSchema.safeParse(EMPTY).success).toBe(true);
    expect(
      stateSchema.safeParse({ ...EMPTY, profile: { name: "Bad" } }).success,
    ).toBe(false);
    expect(
      stateSchema.safeParse({ ...EMPTY, run: { id: "broken" } }).success,
    ).toBe(false);
  });
});
