import { z } from "zod";
export const AGES = ["5–7", "8–12", "13–17", "18+"] as const;
export const POSITIONS = [
  "Explore all positions",
  "Quarterback",
  "Wide receiver",
  "Running back",
  "Offensive line",
  "Defensive line",
  "Linebacker",
  "Defensive back",
] as const;
export const LEVELS = [
  "New to the game",
  "Building fundamentals",
  "Experienced",
] as const;
export const GOALS = [
  "Coordination",
  "Footwork",
  "Ball skills",
  "Game understanding",
] as const;
export const SPORTS = [
  { id: "football", name: "American football", available: true },
  { id: "basketball", name: "Basketball", available: false },
  { id: "soccer", name: "Soccer", available: false },
];
export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.enum(AGES),
  position: z.enum(POSITIONS),
  level: z.enum(LEVELS),
  goal: z.enum(GOALS),
  guardian: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;
export type Age = Profile["age"];
export const PROFILES: Profile[] = [
  {
    id: "avery",
    name: "Avery",
    age: "5–7",
    position: "Explore all positions",
    level: "New to the game",
    goal: "Coordination",
    guardian: true,
  },
  {
    id: "jordan",
    name: "Jordan",
    age: "8–12",
    position: "Wide receiver",
    level: "New to the game",
    goal: "Ball skills",
    guardian: true,
  },
  {
    id: "casey",
    name: "Casey",
    age: "13–17",
    position: "Quarterback",
    level: "Building fundamentals",
    goal: "Footwork",
    guardian: true,
  },
  {
    id: "morgan",
    name: "Morgan",
    age: "18+",
    position: "Defensive back",
    level: "Experienced",
    goal: "Game understanding",
    guardian: false,
  },
];
export const drillSchema = z.object({
  id: z.string(),
  sport: z.literal("football"),
  title: z.string(),
  skill: z.enum(GOALS),
  ages: z.array(z.enum(AGES)),
  positions: z.array(z.enum(POSITIONS)),
  levels: z.array(z.enum(LEVELS)),
  minutes: z.number().positive(),
  equipment: z.string(),
  lesson: z.string(),
  steps: z.array(z.string()).min(1),
  cue: z.string(),
  kind: z.enum(["movement", "hands", "read"]),
  source: z.enum(["sample", "local", "shared"]),
  visibility: z.enum(["public_sample", "member_only"]).optional(),
  assetId: z.string().optional(),
  assetType: z.string().optional(),
  assetName: z.string().optional(),
  assetUrl: z.string().url().startsWith("https://").optional(),
  backendVersion: z.number().int().positive().optional(),
});
export type Drill = z.infer<typeof drillSchema>;
export const runSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  drillIds: z.array(z.string()).min(1),
  index: z.number().int().nonnegative(),
  phase: z.enum(["lesson", "practice", "done"]),
});
export type Run = z.infer<typeof runSchema>;
export const recordSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  titles: z.array(z.string()),
  minutes: z.number(),
  date: z.string(),
  reflection: z.enum([
    "Felt comfortable",
    "Still practicing",
    "Prefer not to say",
  ]),
});
export type RecordEntry = z.infer<typeof recordSchema>;
export const stateSchema = z.object({
  version: z.literal(1),
  profile: profileSchema.nullable(),
  history: z.array(recordSchema),
  custom: z.array(drillSchema),
  run: runSchema.nullable(),
});
export type State = z.infer<typeof stateSchema>;
export const EMPTY: State = {
  version: 1,
  profile: null,
  history: [],
  custom: [],
  run: null,
};
export function matches(drill: Drill, profile: Profile) {
  return (
    drill.sport === "football" &&
    drill.ages.includes(profile.age) &&
    (drill.positions.length === 0 ||
      drill.positions.includes(profile.position)) &&
    drill.levels.includes(profile.level) &&
    drill.skill === profile.goal
  );
}
export function planFor(profile: Profile, drills: Drill[]) {
  const eligible = drills.filter(
    (d) =>
      d.ages.includes(profile.age) &&
      d.levels.includes(profile.level) &&
      (d.positions.length === 0 || d.positions.includes(profile.position)),
  );
  const ranked = [...eligible].sort(
    (a, b) =>
      Number(b.skill === profile.goal) - Number(a.skill === profile.goal),
  );
  return ranked.slice(0, profile.age === "5–7" ? 2 : 3);
}
export function completeRun(
  state: State,
  run: Run,
  drills: Drill[],
  reflection: RecordEntry["reflection"],
): State {
  if (
    !state.profile ||
    run.profileId !== state.profile.id ||
    run.phase !== "done" ||
    state.history.some((h) => h.id === run.id)
  )
    return state;
  const selected = run.drillIds
    .map((id) => drills.find((d) => d.id === id))
    .filter((d): d is Drill => !!d);
  if (selected.length !== run.drillIds.length) return state;
  return {
    ...state,
    run: null,
    history: [
      {
        id: run.id,
        profileId: run.profileId,
        titles: selected.map((d) => d.title),
        minutes: selected.reduce((n, d) => n + d.minutes, 0),
        date: new Date().toISOString(),
        reflection,
      },
      ...state.history,
    ],
  };
}
export function filterDrills(
  drills: Drill[],
  filters: {
    query: string;
    age: string;
    position: string;
    level: string;
    skill: string;
  },
) {
  return drills.filter(
    (d) =>
      (d.title + " " + d.lesson + " " + d.skill)
        .toLowerCase()
        .includes(filters.query.toLowerCase().trim()) &&
      (!filters.age || d.ages.includes(filters.age as Age)) &&
      (!filters.position ||
        d.positions.length === 0 ||
        d.positions.includes(filters.position as Profile["position"])) &&
      (!filters.level ||
        d.levels.includes(filters.level as Profile["level"])) &&
      (!filters.skill || d.skill === filters.skill),
  );
}
