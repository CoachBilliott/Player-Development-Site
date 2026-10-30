import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Receipt, RosterSubcheck } from "./policy";
export const profiles = [
  "93000000-0000-4000-8000-000000000010",
  "93000000-0000-4000-8000-000000000011",
  "93000000-0000-4000-8000-000000000012",
] as const;
export const coachIds = [
  "7853c212-2c83-4b6a-ab95-0c8fa81c75af",
  "2d136c01-ce7d-4c4d-b814-5af860dd707c",
] as const;
const actors: Record<string, { role: string; allowed: readonly string[] }> = {
  "17054a51-d756-4b9e-8048-c82973fe0c55": { role: "owner", allowed: profiles },
  "134e7d0b-e54d-488b-8848-8254db86757c": {
    role: "manager",
    allowed: profiles,
  },
  [coachIds[0]]: { role: "coach", allowed: [profiles[0]] },
  [coachIds[1]]: { role: "coach", allowed: profiles.slice(1) },
  "dc6804e6-fc2f-4bb0-a7ca-de8514e09024": { role: "parent", allowed: [] },
  "2a566ee0-dd1f-4244-a16f-2c086bc1c6a2": { role: "parent", allowed: [] },
};
export type Actor = { id: string; role: string };
export type ProbeResult = { result: Receipt["result"]; note: string };
class ProbeFailure extends Error {}
const count = z.number().int().nonnegative();
const pageSchema = z.object({
  source: z.literal("account_backend"),
  scope: z.enum(["assigned_athletes", "all_repformed_clients"]),
  rows: z.array(
    z.object({
      athlete_id: z.string().uuid(),
      client_id: z.string().uuid(),
      athlete_name: z.string(),
      client_label: z.string(),
      coach_label: z.string().nullable().optional(),
      position: z.string().optional(),
      workout_title: z.string().nullish(),
    }),
  ),
  coaches: z.array(z.object({ id: z.string().uuid(), label: z.string() })),
  page: z.object({
    number: z.number().int().positive(),
    size: z.number().int().positive(),
    pages: z.number().int().positive(),
    total: count,
    matched: count,
    athletes: count,
    clients: count,
    counts: z.object({ overdue: count, attention: count, ready: count }),
    ages: z.array(z.string()),
    positions: z.array(z.string()),
    coaches: z.array(z.object({ id: z.string().uuid(), label: z.string() })),
  }),
});
function requireCheck(ok: boolean) {
  if (!ok) throw new ProbeFailure();
}
// No session extraction, trusted JWT claims, role override, legacy fallback or writes.
async function read(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
) {
  return await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000));
}
function permission(
  error: { code?: string; message?: string } | null,
  detail = false,
) {
  return (
    error?.code === "42501" ||
    (error?.code === "P0001" &&
      error.message ===
        (detail
          ? "This athlete is outside your service roster."
          : "Staff access is required."))
  );
}
async function verified(client: SupabaseClient, actor: Actor) {
  const expected = actors[actor.id];
  if (!expected || expected.role !== actor.role) throw Error();
  const user = await client.auth.getUser();
  if (user.error || user.data.user?.id !== actor.id) throw Error();
  const role = await read(client, "current_account_role");
  if (role.error || role.data !== actor.role) throw Error();
  return expected;
}
const input = {
  search_text: "",
  status_filter: "all",
  age_filter: "",
  position_filter: "",
  coach_filter: "",
  page_number: 1,
  page_size: 25,
};
async function page(
  client: SupabaseClient,
  args: Record<string, unknown> = {},
) {
  const response = await read(client, "staff_client_service_roster_page", {
    ...input,
    ...args,
  });
  if (response.error) throw Error(); // Missing RPC, expired Auth, timeout and all other errors are BLOCKED.
  const parsed = pageSchema.safeParse(response.data);
  if (!parsed.success) throw new ProbeFailure();
  const p = parsed.data.page;
  requireCheck(
    p.number <= p.pages &&
      p.matched <= p.total &&
      p.pages === Math.max(1, Math.ceil(p.matched / p.size)) &&
      parsed.data.rows.length ===
        Math.min(p.size, Math.max(0, p.matched - (p.number - 1) * p.size)),
  );
  return parsed.data;
}
function ids(rows: { athlete_id: string }[]) {
  return rows.map((r) => r.athlete_id).sort();
}
function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
async function guarded(action: () => Promise<string>): Promise<ProbeResult> {
  try {
    return { result: "passed", note: await action() };
  } catch (e) {
    return e instanceof ProbeFailure
      ? {
          result: "failed",
          note:
            e.message ||
            "Observed response contradicted the approved fictional scope or page contract. Stop and inspect.",
        }
      : {
          result: "blocked",
          note: "Not confirmed: missing migration, session, timeout, transport or fixture mismatch. No fallback, mutation or acceptance pass.",
        };
  }
}
export function rosterScope(client: SupabaseClient, actor: Actor) {
  return guarded(async () => {
    const expected = await verified(client, actor);
    if (actor.role === "parent") {
      const response = await read(
        client,
        "staff_client_service_roster_page",
        input,
      );
      if (!response.error) throw new ProbeFailure();
      if (!permission(response.error)) throw Error();
      return "Verified Parent was explicitly denied the installed staff RPC; no rows/counts were exposed.";
    }
    const data = await page(client);
    requireCheck(
      same(ids(data.rows), [...expected.allowed].sort()) &&
        data.page.total === expected.allowed.length &&
        data.page.athletes === expected.allowed.length &&
        data.page.matched === expected.allowed.length &&
        data.scope ===
          (actor.role === "coach"
            ? "assigned_athletes"
            : "all_repformed_clients") &&
        (actor.role !== "coach" || data.coaches.length === 0),
    );
    requireCheck(
      data.page.ages.every((x) => x === "18+") &&
        data.page.positions.every((x) => x === "Quarterback") &&
        data.page.coaches.every((c) =>
          expected.allowed.some(
            (p) => (p === profiles[0] ? coachIds[0] : coachIds[1]) === c.id,
          ),
        ),
    );
    return `Confirmed ${data.page.total} scoped fictional athletes, ${data.page.clients} clients; ${data.scope}. Only counts and fixed outcomes are retained.`;
  });
}
export type VisibleRosterRow = z.infer<typeof pageSchema>["rows"][number];
export function visibleRosterSearch(row: VisibleRosterRow, query: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visible = normalize(
    [
      row.athlete_name,
      row.client_label,
      row.position,
      row.coach_label,
      row.workout_title,
    ]
      .filter((v) => v != null)
      .join(" "),
  );
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => visible.includes(word));
}
const fixtureLabels = new Map<string, string>(
  profiles.map((p, i) => [
    p,
    ["Fictional Avery", "Fictional Jordan", "Fictional Other"][i],
  ]),
);
function safeSelection(selected: readonly string[]) {
  return selected.length
    ? selected
        .map((id) => fixtureLabels.get(id) || "Unexpected profile")
        .sort()
        .join(", ")
    : "none";
}
export function rosterPages(
  client: SupabaseClient,
  actor: Actor,
  report: (check: RosterSubcheck, result: Receipt["result"]) => void = () => {},
) {
  return guarded(async () => {
    const expected = await verified(client, actor);
    if (!expected.allowed.length) throw Error();
    async function check(name: RosterSubcheck, action: () => Promise<void>) {
      try {
        await action();
        report(name, "passed");
      } catch (e) {
        report(name, e instanceof ProbeFailure ? "failed" : "blocked");
        throw e;
      }
    }
    function selection(
      name: RosterSubcheck,
      actual: string[],
      wanted: readonly string[],
      matched: number,
      total: number,
    ) {
      if (
        !same([...actual].sort(), [...wanted].sort()) ||
        matched !== wanted.length ||
        total !== expected.allowed.length
      )
        throw new ProbeFailure(
          `${name}: expected ${safeSelection(wanted)} (${wanted.length} matches); observed ${safeSelection(actual)} (${matched} matches). Scoped total must remain ${expected.allowed.length}.`,
        );
    }
    let baseline: z.infer<typeof pageSchema>;
    await check("roster baseline scope", async () => {
      baseline = await page(client);
      selection(
        "roster baseline scope",
        ids(baseline.rows),
        expected.allowed,
        baseline.page.matched,
        baseline.page.total,
      );
      if (actor.role === "coach")
        requireCheck(
          baseline.rows.every(
            (r) => r.client_label === `Client ${r.client_id.slice(0, 8)}`,
          ),
        );
    });
    const first = await page(client, { page_size: 1 });
    await check("roster page traversal", async () => {
      const found = [...ids(first.rows)];
      for (let n = 2; n <= expected.allowed.length; n++)
        found.push(
          ...ids((await page(client, { page_size: 1, page_number: n })).rows),
        );
      selection(
        "roster page traversal",
        found,
        expected.allowed,
        found.length,
        first.page.total,
      );
    });
    await check("roster repeated read", async () => {
      const retry = await page(client, { page_size: 1 });
      requireCheck(
        same(ids(first.rows), ids(retry.rows)) && same(first.page, retry.page),
      );
    });
    await check("roster last page", async () =>
      requireCheck(
        (await page(client, { page_size: 1, page_number: 999999 })).page
          .number === expected.allowed.length,
      ),
    );
    const cases: [RosterSubcheck, string][] = [
      ["roster search Avery", "Avery"],
      ["roster search Jordan", "Jordan"],
      ["roster search Other", "Other"],
      ["roster search no result", "no-such-fictional-athlete"],
      ["roster quoted search", "Avery'"],
      ["roster quoted phrase", '"Avery"'],
      [
        "roster visible coach label",
        "repformed-learning-other-coach@example.test",
      ],
      ["roster primary client label", "repformed-learning-parent@example.test"],
      [
        "roster other client label",
        "repformed-learning-other-parent@example.test",
      ],
    ];
    for (const [name, search] of cases)
      await check(name, async () => {
        const wanted = baseline!.rows
          .filter((row) => visibleRosterSearch(row, search))
          .map((row) => row.athlete_id);
        // Client emails are intentionally absent from Coach-visible fields.
        if (
          actor.role === "coach" &&
          (name === "roster primary client label" ||
            name === "roster other client label")
        )
          requireCheck(wanted.length === 0);
        const result = await page(client, { search_text: search });
        selection(
          name,
          ids(result.rows),
          wanted,
          result.page.matched,
          result.page.total,
        );
      });
    await check("roster combined filters", async () => {
      const result = await page(client, {
        search_text: "Avéry",
        age_filter: "18+",
        position_filter: "Quarterback",
        coach_filter: coachIds[0],
      });
      const wanted = expected.allowed.includes(profiles[0])
        ? [profiles[0]]
        : [];
      selection(
        "roster combined filters",
        ids(result.rows),
        wanted,
        result.page.matched,
        result.page.total,
      );
    });
    await check("roster unassigned filter", async () => {
      const result = await page(client, { status_filter: "unassigned" });
      selection(
        "roster unassigned filter",
        ids(result.rows),
        [],
        result.page.matched,
        result.page.total,
      );
    });
    return "Each redacted subcheck is recorded separately. Search matches authorized athlete, client, position, coach and workout labels; hidden client emails do not match a Coach. No hosted load or changed-assignment claim.";
  });
}
export function rosterDetails(client: SupabaseClient, actor: Actor) {
  return guarded(async () => {
    const expected = await verified(client, actor);
    // Existing015 is independent of023: read an allowed known profile FIRST,
    // then known out-of-scope profiles. This remains usable after023rollback.
    const ordered = [
      ...expected.allowed,
      ...profiles.filter((id) => !expected.allowed.includes(id)),
    ];
    for (const id of ordered) {
      const response = await read(client, "staff_athlete_service", {
        target_profile: id,
      });
      if (expected.allowed.includes(id)) {
        if (response.error) throw Error();
        requireCheck(
          z.object({ athlete_id: z.literal(id) }).safeParse(response.data)
            .success,
        );
      } else {
        if (!response.error) throw new ProbeFailure();
        if (!permission(response.error, true)) throw Error();
      }
    }
    return "Existing015 direct detail reads match known permitted/denied scope, independently of023. This can verify legacy continuity after rollback. No assignment or role changes were made.";
  });
}
export function anonymousRoster(client: SupabaseClient) {
  return guarded(async () => {
    const response = await read(
      client,
      "staff_client_service_roster_page",
      input,
    );
    if (!response.error) throw new ProbeFailure();
    if (!permission(response.error)) throw Error();
    return "Public-key client received explicit permission denial. Missing function/network/Auth errors are not counted as passes; compare a successful staff control.";
  });
}
