import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  staffFixture,
  staffState,
  coachA,
  coachB,
} from "./staffServiceFixture";
import { staffId, uid } from "./workoutFixture";
import { serviceRows, serviceState } from "../src/staffServiceView";
// Presentation fixtures only. Real SQL grants/scope/counts are separately tested
// against migrations in staffServicePolicies.test.ts, never a live project here.
async function paged(
  context: BrowserContext,
  data = staffState(),
  role = "owner",
  actor = staffId,
  enabled: unknown = true,
) {
  await staffFixture(context, data, role, actor);
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        staffRosterEnabled: true,
        staffRosterPagingEnabled: enabled,
      },
    }),
  );
  const calls: Record<string, unknown>[] = [];
  const control: {
    legacyReads: number;
    error: string;
    invalid: boolean;
    beforeReply: (body: Record<string, unknown>) => Promise<void>;
  } = {
    legacyReads: 0,
    error: "",
    invalid: false,
    beforeReply: async () => {},
  };
  context.on("request", (r) => {
    if (new URL(r.url()).pathname.endsWith("/rpc/staff_client_service_roster"))
      control.legacyReads++;
  });
  await context.route(
    "**/rest/v1/rpc/staff_client_service_roster_page",
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.push(body);
      if (control.error)
        return route.fulfill({
          status: control.error === "42501" ? 403 : 404,
          json: { code: control.error, message: "Fictional service error" },
        });
      const scope = data.rows
        .filter(
          (r) =>
            ["owner", "manager"].includes(role) ||
            (role === "coach" && r.coach_id === actor),
        )
        .map((r) =>
          role === "coach"
            ? { ...r, client_label: `Client ${r.client_id.slice(0, 8)}` }
            : { ...r },
        );
      const filtered = scope.filter(
        (r) =>
          (!body.age_filter || r.age_group === body.age_filter) &&
          (!body.position_filter || r.position === body.position_filter) &&
          (!body.coach_filter ||
            (body.coach_filter === "none"
              ? !r.coach_id
              : r.coach_id === body.coach_filter)),
      );
      const matched = serviceRows(
          filtered,
          String(body.search_text),
          String(body.status_filter),
        ),
        size = Number(body.page_size),
        pages = Math.max(1, Math.ceil(matched.length / size)),
        number = Math.min(Number(body.page_number), pages);
      const choices = [
        { id: coachA, label: "fictional-coach-a@example.test" },
        { id: coachB, label: "fictional-coach-b@example.test" },
      ];
      const coaches = [
        ...new Map(
          scope.flatMap((r) =>
            r.coach_id
              ? [
                  [
                    r.coach_id,
                    {
                      id: r.coach_id,
                      label: r.coach_label || "Assigned coach",
                    },
                  ] as const,
                ]
              : [],
          ),
        ).values(),
      ];
      const json = {
        source: "account_backend",
        scope: role === "coach" ? "assigned_athletes" : "all_repformed_clients",
        rows: control.invalid
          ? []
          : matched.slice((number - 1) * size, number * size),
        coaches: ["owner", "manager"].includes(role) ? choices : [],
        page: {
          number,
          size,
          pages,
          total: scope.length,
          matched: matched.length,
          athletes: scope.filter((r) => r.athlete_id).length,
          clients: new Set(scope.map((r) => r.client_id)).size,
          counts: {
            overdue: scope.filter((r) => serviceState(r) === "overdue").length,
            attention: scope.filter((r) => serviceState(r) === "attention")
              .length,
            ready: scope.filter((r) => serviceState(r) === "ready").length,
          },
          ages: [
            ...new Set(scope.map((r) => r.age_group).filter(Boolean)),
          ].sort(),
          positions: [
            ...new Set(scope.map((r) => r.position).filter(Boolean)),
          ].sort(),
          coaches,
        },
      };
      await control.beforeReply(body);
      await route.fulfill({ json }).catch(() => {
        /* A deliberately cancelled request cannot change the view. */
      });
    },
  );
  return { data, calls, control };
}
function many(n = 1000) {
  const data = staffState(),
    row = data.rows[0];
  data.rows = Array.from({ length: n }, (_, i) => ({
    ...row,
    athlete_id: uid(9000 + i),
    athlete_name: `Fictional Athlete ${String(i).padStart(4, "0")}`,
    position: i === n - 1 ? "Defensive back" : "Quarterback",
    pending_reviews: 0,
    overdue_reviews: 0,
    review_tasks: [],
    next_action: "Review practice participation",
  }));
  return data;
}
const table = (page: import("@playwright/test").Page) =>
  page.getByRole("table", {
    name: "Athlete roster, ordered by service priority",
  });

test("server pages carry full-scope totals/facets, return only25rows and preserve athlete/back/search context", async ({
  page,
  context,
}) => {
  const f = await paged(context, many());
  await page.goto("./?source=app#workspace");
  await expect(table(page).locator("tbody tr")).toHaveCount(25);
  await expect(
    page.getByText("1000 athletes · 1 client · all clients", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Showing 1–25 of 1000 matching records", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Filter by age, position or coach", { exact: true })
    .click();
  await expect(
    page
      .getByRole("combobox", { name: "Football position" })
      .getByRole("option", { name: "Defensive back", exact: true }),
  ).toHaveCount(1);
  const nav = page.getByRole("navigation", { name: "Athlete roster pages" });
  await nav.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByText("Showing 26–50 of 1000 matching records", { exact: true }),
  ).toBeFocused();
  await table(page)
    .getByRole("button", { name: /Fictional Athlete 0025/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Fictional Athlete 0025",
  );
  await page.getByRole("button", { name: "Back to athletes" }).click();
  await expect(
    table(page).getByRole("button", { name: /Fictional Athlete 0025/ }),
  ).toBeFocused();
  await expect(page.getByText("Page 2 of 40", { exact: true })).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search athletes or clients" })
    .fill("0999");
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  await expect(table(page)).toContainText("Fictional Athlete 0999");
  await expect(
    page.getByText(
      "Showing 1 of 1 matching record (1000 in your scope) for “0999”",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  expect(f.calls.at(-1)).toMatchObject({
    search_text: "0999",
    page_number: 1,
    page_size: 25,
  });
  expect(f.control.legacyReads).toBe(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(table(page).locator("tbody tr")).toHaveCount(25);
  await expect(page.getByText("Page 1 of 40", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("query loading is honest, debounced requests cancel stale replies and filters remain reusable", async ({
  page,
  context,
}) => {
  const data = many(30);
  data.rows[0].athlete_name = "Old fictional";
  data.rows[1].athlete_name = "New fictional";
  const f = await paged(context, data);
  await page.goto("./?source=app#workspace");
  await expect(table(page).locator("tbody tr")).toHaveCount(25);
  let start!: () => void, release!: () => void, done!: () => void;
  const started = new Promise<void>((r) => (start = r)),
    gate = new Promise<void>((r) => (release = r)),
    finished = new Promise<void>((r) => (done = r));
  f.control.beforeReply = async (body) => {
    if (body.search_text === "Old") {
      start();
      await gate;
      done();
    }
  };
  const search = page.getByRole("searchbox", {
    name: "Search athletes or clients",
  });
  await search.fill("Old");
  await started;
  await expect(page.locator(".staff-result-count")).toHaveText(
    "Loading matching athletes…",
  );
  await expect(table(page).getByRole("button").first()).toBeDisabled();
  await search.fill("New");
  await expect(table(page)).toContainText("New fictional");
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  release();
  await finished;
  await expect(table(page)).not.toContainText("Old fictional");
  await search.fill("not present");
  await expect(
    page.getByRole("heading", { name: "No matching athletes." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset search and filters" }).click();
  await expect(table(page).locator("tbody tr")).toHaveCount(25);
  const mark = f.calls.length;
  await search.pressSequentially("0999", { delay: 20 });
  await expect(
    page.getByRole("heading", { name: "No matching athletes." }),
  ).toBeVisible();
  expect(f.calls.slice(mark).map((x) => x.search_text)).toEqual(["0999"]);
});

for (const role of ["owner", "manager", "coach"] as const)
  test(`${role} paged server view retains role scope and ignores unauthorized other-coach filters`, async ({
    page,
    context,
  }) => {
    const f = await paged(
      context,
      staffState(),
      role,
      role === "coach" ? coachA : staffId,
    );
    await page.goto("./?source=app#workspace");
    await expect(table(page).locator("tbody tr")).toHaveCount(
      role === "coach" ? 1 : 3,
    );
    if (role === "coach") {
      await expect(table(page)).not.toContainText("Fictional Avery");
      await expect(table(page)).not.toContainText("Fictional Morgan");
    } else await expect(table(page)).toContainText("Fictional Avery");
    expect(f.control.legacyReads).toBe(0);
  });

test("a denial clears cached rows, shows an error and never falls back to a different read endpoint", async ({
  page,
  context,
}) => {
  const f = await paged(context);
  await page.goto("./?source=app#workspace");
  await expect(table(page).locator("tbody tr")).toHaveCount(3);
  f.control.error = "42501";
  await page.getByRole("button", { name: "Refresh client service" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "roster page could not be loaded",
  );
  await expect(table(page)).toHaveCount(0);
  expect(f.control.legacyReads).toBe(0);
});

test("only a missing capability uses the existing scoped compatibility connection during rollback", async ({
  page,
  context,
}) => {
  const f = await paged(context, staffState(), "coach", coachA);
  f.control.error = "PGRST202";
  await page.goto("./?source=app#workspace");
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  await expect(table(page)).toContainText("Fictional Jordan");
  await expect(table(page)).not.toContainText("Fictional Avery");
  await expect(
    page.getByText(/Your roster may take longer to load/),
  ).toBeVisible();
  expect(f.control.legacyReads).toBe(1);
});

test("invalid responses are errors rather than false emptiness and retry preserves the intended search", async ({
  page,
  context,
}) => {
  const f = await paged(context);
  await page.goto("./?source=app#workspace");
  await expect(table(page).locator("tbody tr")).toHaveCount(3);
  f.control.invalid = true;
  await page
    .getByRole("searchbox", { name: "Search athletes or clients" })
    .fill("Avery");
  await expect(page.getByRole("alert")).toContainText(
    "response could not be verified",
  );
  await expect(
    page.getByRole("heading", { name: "No matching athletes." }),
  ).toHaveCount(0);
  f.control.invalid = false;
  await page.getByRole("button", { name: "Refresh client service" }).click();
  await expect(table(page)).toContainText("Fictional Avery");
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("searchbox", { name: "Search athletes or clients" }),
  ).toHaveValue("Avery");
});

test("server clamps a smaller refreshed scope to a valid last page", async ({
  page,
  context,
}) => {
  const f = await paged(context, many(31));
  await page.goto("./?source=app#workspace");
  await page
    .getByRole("navigation", { name: "Athlete roster pages" })
    .getByRole("button", { name: "Next page" })
    .click();
  await expect(table(page).locator("tbody tr")).toHaveCount(6);
  f.data.rows = f.data.rows.slice(0, 1);
  await page.getByRole("button", { name: "Refresh client service" }).click();
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByText("Showing 1 of 1 matching record", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Athlete roster pages" }),
  ).toHaveCount(0);
});

test("nonboolean rollout flags retain the existing read path without per-keystroke reloads", async ({
  page,
  context,
}) => {
  const f = await paged(context, staffState(), "owner", staffId, "true");
  await page.goto("./?source=app#workspace");
  await expect(table(page).locator("tbody tr")).toHaveCount(3);
  const initialReads = f.control.legacyReads;
  expect(initialReads).toBeGreaterThan(0);
  await page
    .getByRole("searchbox", { name: "Search athletes or clients" })
    .fill("Avery");
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  expect(f.calls).toHaveLength(0);
  expect(f.control.legacyReads).toBe(initialReads);
});

test("an empty previous result is not labeled no matches while a new search is loading", async ({
  page,
  context,
}) => {
  const f = await paged(context);
  await page.goto("./?source=app#workspace");
  await expect(table(page).locator("tbody tr")).toHaveCount(3);
  const search = page.getByRole("searchbox", {
    name: "Search athletes or clients",
  });
  await search.fill("not present");
  await expect(
    page.getByRole("heading", { name: "No matching athletes." }),
  ).toBeVisible();
  let started!: () => void, release!: () => void;
  const requested = new Promise<void>((r) => (started = r)),
    gate = new Promise<void>((r) => (release = r));
  f.control.beforeReply = async (body) => {
    if (body.search_text === "Jordan") {
      started();
      await gate;
    }
  };
  await search.fill("Jordan");
  await requested;
  await expect(page.locator(".staff-result-count")).toHaveText(
    "Loading matching athletes…",
  );
  await expect(
    page.getByRole("heading", { name: "No matching athletes." }),
  ).toHaveCount(0);
  release();
  await expect(table(page)).toContainText("Fictional Jordan");
});

test("a stalled roster page times out independently of Auth and can be retried without a fake empty success", async ({
  page,
  context,
}) => {
  await page.clock.install();
  const f = await paged(context);
  let started!: () => void, release!: () => void;
  const requested = new Promise<void>((r) => (started = r)),
    gate = new Promise<void>((r) => (release = r));
  f.control.beforeReply = async () => {
    started();
    await gate;
  };
  await page.goto("./?source=app#workspace");
  await requested;
  await page.clock.fastForward(16000);
  await expect(page.getByRole("alert")).toContainText(
    "roster page could not be loaded",
  );
  await expect(table(page)).toHaveCount(0);
  expect(f.control.legacyReads).toBe(0);
  release();
  f.control.beforeReply = async () => {};
  await page.getByRole("button", { name: "Refresh client service" }).click();
  await expect(table(page).locator("tbody tr")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Athletes.", exact: true }),
  ).toBeVisible();
});
