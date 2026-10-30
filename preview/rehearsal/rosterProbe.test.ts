import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rosterScope,
  rosterPages,
  rosterDetails,
  anonymousRoster,
  profiles,
  coachIds,
  visibleRosterSearch,
} from "./rosterProbe";
const owner = { id: "17054a51-d756-4b9e-8048-c82973fe0c55", role: "owner" };
const manager = { id: "134e7d0b-e54d-488b-8848-8254db86757c", role: "manager" };
const parent = { id: "dc6804e6-fc2f-4bb0-a7ca-de8514e09024", role: "parent" };
function fixture(actor = owner, failure = "") {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const allowed: readonly string[] =
    actor.role === "parent"
      ? []
      : actor.id === coachIds[0]
        ? [profiles[0]]
        : actor.id === coachIds[1]
          ? profiles.slice(1)
          : profiles;
  const denied = (detail = false) => ({
    data: null,
    error: {
      code: "P0001",
      message: detail
        ? "This athlete is outside your service roster."
        : "Staff access is required.",
    },
  });
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: failure === "expired" ? "other" : actor.id } },
        error: null,
      }),
    },
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      let result: unknown;
      if (name === "current_account_role")
        result = { data: actor.role, error: null };
      else if (failure === "missing" && name !== "staff_athlete_service")
        result = {
          data: null,
          error: { code: "PGRST202", message: "Missing RPC" },
        };
      else if (failure === "transport")
        result = {
          data: null,
          error: { code: "", message: "Failed to fetch" },
        };
      else if (name === "staff_athlete_service")
        result = allowed.includes(args.target_profile as string)
          ? { data: { athlete_id: args.target_profile }, error: null }
          : denied(true);
      else if (actor.role === "parent" && failure !== "leak") result = denied();
      else {
        const base = failure === "leak" ? profiles : allowed;
        let ids = [...base];
        const rowFor = (profile: string) => {
          const i = profiles.indexOf(profile as (typeof profiles)[number]);
          const ownerId =
            i === 2 ? "2a566ee0-dd1f-4244-a16f-2c086bc1c6a2" : parent.id;
          const email =
            i === 2
              ? "repformed-learning-other-parent@example.test"
              : "repformed-learning-parent@example.test";
          return {
            athlete_id: profile,
            client_id: ownerId,
            athlete_name: [
              "Fictional Avery",
              "Fictional Jordan",
              "Fictional Other",
            ][i],
            client_label:
              actor.role === "coach" && failure !== "client-label-leak"
                ? `Client ${ownerId.slice(0, 8)}`
                : email,
            coach_label:
              i === 0
                ? "repformed-learning-coach@example.test"
                : "repformed-learning-other-coach@example.test",
            position: "Quarterback",
            workout_title: "",
          };
        };
        if (args.search_text)
          ids = ids.filter((id) => {
            const row = rowFor(id);
            const hiddenEmail =
              id === profiles[2]
                ? "repformed-learning-other-parent@example.test"
                : "repformed-learning-parent@example.test";
            const text =
              failure === "nickname-search"
                ? row.athlete_name
                : [
                    row.athlete_name,
                    row.client_label,
                    row.coach_label,
                    row.position,
                    row.workout_title,
                    failure === "hidden-search" ? hiddenEmail : "",
                  ].join(" ");
            const normalized = text
              .normalize("NFKD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();
            return String(args.search_text)
              .normalize("NFKD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .split(/\s+/)
              .filter(Boolean)
              .every((w) => normalized.includes(w));
          });
        if (args.coach_filter)
          ids = ids.filter(
            (id) =>
              (id === profiles[0] ? coachIds[0] : coachIds[1]) ===
              args.coach_filter,
          );
        if (args.status_filter === "unassigned") ids = [];
        const size = Number(args.page_size),
          pages = Math.max(1, Math.ceil(ids.length / size)),
          number = Math.min(Number(args.page_number), pages);
        const rows = ids.slice((number - 1) * size, number * size).map(rowFor);
        result = {
          error: null,
          data:
            failure === "malformed"
              ? { rows: [] }
              : {
                  source: "account_backend",
                  scope:
                    actor.role === "coach"
                      ? "assigned_athletes"
                      : "all_repformed_clients",
                  rows,
                  coaches: [],
                  page: {
                    number,
                    size,
                    pages,
                    total: base.length,
                    matched: ids.length,
                    athletes: base.length,
                    clients: 1,
                    counts: { overdue: 0, attention: base.length, ready: 0 },
                    ages: ["18+"],
                    positions: ["Quarterback"],
                    coaches: [],
                  },
                },
        };
      }
      return {
        abortSignal: async (signal: AbortSignal) => {
          expect(signal).toBeInstanceOf(AbortSignal);
          return result;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
describe("023 ordinary-client read-only acceptance", () => {
  it.each([
    owner,
    manager,
    { id: coachIds[0], role: "coach" },
    { id: coachIds[1], role: "coach" },
  ])(
    "checks scope/paging/known direct boundaries for $role $id",
    async (actor) => {
      const f = fixture(actor);
      expect((await rosterScope(f.client, actor)).result).toBe("passed");
      expect((await rosterPages(f.client, actor)).result).toBe("passed");
      expect((await rosterDetails(f.client, actor)).result).toBe("passed");
      expect(new Set(f.calls.map((c) => c.name))).toEqual(
        new Set([
          "current_account_role",
          "staff_client_service_roster_page",
          "staff_athlete_service",
        ]),
      );
      expect(
        f.calls.some((c) =>
          Object.keys(c.args).some((k) => /actor|token|role/.test(k)),
        ),
      ).toBe(false);
    },
  );
  it("requires explicit installed-RPC denial for Parent, not a missing migration or network error", async () => {
    expect((await rosterScope(fixture(parent).client, parent)).result).toBe(
      "passed",
    );
    expect((await rosterDetails(fixture(parent).client, parent)).result).toBe(
      "passed",
    );
    expect((await rosterPages(fixture(parent).client, parent)).result).toBe(
      "blocked",
    );
    for (const cause of ["missing", "transport", "expired"])
      expect(
        (await rosterScope(fixture(parent, cause).client, parent)).result,
      ).toBe("blocked");
    expect(
      (await rosterScope(fixture(parent, "leak").client, parent)).result,
    ).toBe("failed");
  });
  it("fails an assigned coach leak rather than accepting an unscoped response", async () => {
    const actor = { id: coachIds[0], role: "coach" };
    expect(
      (await rosterScope(fixture(actor, "leak").client, actor)).result,
    ).toBe("failed");
  });
  it("does not read roster on changed identity, unknown account or asserted role mismatch", async () => {
    const f = fixture(owner, "expired");
    expect((await rosterScope(f.client, owner)).result).toBe("blocked");
    expect(f.calls).toHaveLength(0);
    for (const actor of [
      { id: "unapproved", role: "owner" },
      { id: owner.id, role: "coach" },
    ])
      expect((await rosterScope(fixture().client, actor)).result).toBe(
        "blocked",
      );
  });
  it("keeps malformed and unavailable responses separate; missing never uses legacy fallback", async () => {
    for (const [cause, result] of [
      ["malformed", "failed"],
      ["missing", "blocked"],
      ["transport", "blocked"],
    ]) {
      const f = fixture(owner, cause);
      expect((await rosterScope(f.client, owner)).result).toBe(result);
      expect(f.calls.map((c) => c.name)).not.toContain(
        "staff_client_service_roster",
      );
    }
  });
  it("existing015 direct control still works before installation and after023rollback", async () => {
    const f = fixture(owner, "missing");
    expect((await rosterScope(f.client, owner)).result).toBe("blocked");
    expect((await rosterDetails(f.client, owner)).result).toBe("passed");
  });
  it("anonymous missing capability is blocked, explicit staff denial passes, exposed rows fail", async () => {
    expect(
      (await anonymousRoster(fixture(parent, "missing").client)).result,
    ).toBe("blocked");
    expect((await anonymousRoster(fixture(parent).client)).result).toBe(
      "passed",
    );
    expect((await anonymousRoster(fixture(owner).client)).result).toBe(
      "failed",
    );
  });
});

it("Other matches a permitted coach label as well as the athlete nickname", () => {
  const row = {
    athlete_id: profiles[1],
    client_id: parent.id,
    athlete_name: "Fictional Jordan",
    client_label: "repformed-learning-parent@example.test",
    position: "Quarterback",
    coach_label: "repformed-learning-other-coach@example.test",
    workout_title: "",
  };
  expect(visibleRosterSearch(row, "Other")).toBe(true);
  expect(visibleRosterSearch(row, "Jordan other-coach")).toBe(true);
  expect(
    visibleRosterSearch(
      { ...row, coach_label: "repformed-learning-coach@example.test" },
      "Other",
    ),
  ).toBe(false);
  expect(
    visibleRosterSearch(
      {
        ...row,
        client_label: `Client ${parent.id.slice(0, 8)}`,
        coach_label: "repformed-learning-coach@example.test",
      },
      "repformed-learning-parent@example.test",
    ),
  ).toBe(false);
});
it("reproduces nickname-only oracle mismatch and records exact redacted failing subcheck", async () => {
  const events: { check: string; result: string }[] = [];
  const result = await rosterPages(
    fixture(owner, "nickname-search").client,
    owner,
    (check, result) => events.push({ check, result }),
  );
  expect(result.result).toBe("failed");
  expect(events.at(-1)).toEqual({
    check: "roster search Other",
    result: "failed",
  });
  expect(result.note).toContain("expected Fictional Jordan, Fictional Other");
  expect(result.note).toContain("observed Fictional Other");
  expect(result.note).not.toContain("@example.test");
});
it("a hidden-email search leak fails rather than treating authorized label matching as blanket access", async () => {
  const actor = { id: coachIds[0], role: "coach" };
  const events: string[] = [];
  const result = await rosterPages(
    fixture(actor, "hidden-search").client,
    actor,
    (check, outcome) => {
      if (outcome === "failed") events.push(check);
    },
  );
  expect(result.result).toBe("failed");
  expect(events).toEqual(["roster primary client label"]);
  const disclosed = await rosterPages(
    fixture(actor, "client-label-leak").client,
    actor,
  );
  expect(disclosed.result).toBe("failed");
});
