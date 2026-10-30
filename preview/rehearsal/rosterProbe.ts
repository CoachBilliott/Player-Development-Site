import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Receipt } from "./policy";
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
    z.object({ athlete_id: z.string().uuid(), client_id: z.string().uuid() }),
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
          note: "Observed response contradicted the approved fictional scope or page contract. Stop and inspect.",
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
export function rosterPages(client: SupabaseClient, actor: Actor) {
  return guarded(async () => {
    const expected = await verified(client, actor);
    if (!expected.allowed.length) throw Error();
    const first = await page(client, { page_size: 1 });
    const found = [...ids(first.rows)];
    for (let n = 2; n <= expected.allowed.length; n++)
      found.push(
        ...ids((await page(client, { page_size: 1, page_number: n })).rows),
      );
    requireCheck(same(found.sort(), [...expected.allowed].sort()));
    const retry = await page(client, { page_size: 1 });
    requireCheck(
      same(ids(first.rows), ids(retry.rows)) && same(first.page, retry.page),
    );
    const last = await page(client, { page_size: 1, page_number: 999999 });
    requireCheck(last.page.number === expected.allowed.length);
    for (const search of [
      "Avery",
      "Jordan",
      "Other",
      "no-such-fictional-athlete",
      "Avery'",
      '"Avery"',
    ]) {
      const result = await page(client, { search_text: search });
      const target = profiles[["Avery", "Jordan", "Other"].indexOf(search)];
      const wanted =
        target && expected.allowed.includes(target) ? [target] : [];
      requireCheck(
        same(ids(result.rows), wanted) &&
          result.page.matched === wanted.length &&
          result.page.total === expected.allowed.length,
      );
    }
    const combined = await page(client, {
      search_text: "Avéry",
      age_filter: "18+",
      position_filter: "Quarterback",
      coach_filter: coachIds[0],
    });
    requireCheck(
      same(
        ids(combined.rows),
        expected.allowed.includes(profiles[0]) ? [profiles[0]] : [],
      ),
    );
    const unassigned = await page(client, { status_filter: "unassigned" });
    requireCheck(unassigned.page.matched === 0 && unassigned.rows.length === 0);
    return "Read-only one-row paging, last-page clamp, identical retry, quoted/accent search, combined filters and no-results match the existing fixtures. This is not a hosted load test.";
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
