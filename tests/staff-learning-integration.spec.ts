import { test, expect, type BrowserContext } from "@playwright/test";
import { staffFixture, staffState, athleteA } from "./staffServiceFixture";
import { serviceRows, serviceState } from "../src/staffServiceView";
async function setup(context: BrowserContext, weekly: boolean, manual = true) {
  const data = staffState();
  await staffFixture(context, data, "owner");
  const calls: string[] = [];
  const gate = { weeklyError: "", pause: null as null | (() => Promise<void>) };
  context.on("request", (r) => {
    const name = new URL(r.url()).pathname.split("/").at(-1)!;
    if (name.startsWith("staff_") || name.startsWith("learning_"))
      calls.push(name);
  });
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        staffRosterEnabled: true,
        staffRosterPagingEnabled: manual,
        learningPlansEnabled: weekly,
        deliveryMonitoringEnabled: true,
      },
    }),
  );
  for (const name of [
    "staff_learning_roster_page",
    "staff_client_service_roster_page",
  ]) {
    await context.route(`**/rest/v1/rpc/${name}`, async (r) => {
      if (gate.pause) await gate.pause();
      if (name === "staff_learning_roster_page" && gate.weeklyError)
        return r.fulfill({
          status: 404,
          json: {
            code: gate.weeklyError,
            message: "Fictional missing weekly capability",
          },
        });
      const body = r.request().postDataJSON();
      const rows = serviceRows(
        data.rows,
        body.search_text || "",
        body.status_filter || "all",
      );
      const common = {
        total: data.rows.length,
        matched: rows.length,
        athletes: data.rows.length,
        clients: 2,
        counts: {
          overdue: data.rows.filter((x) => serviceState(x) === "overdue")
            .length,
          attention: data.rows.filter((x) => serviceState(x) === "attention")
            .length,
          ready: data.rows.filter((x) => serviceState(x) === "ready").length,
        },
        ages: ["18+"],
        positions: ["Quarterback", "Defensive back"],
      };
      return r.fulfill({
        json: {
          source: "account_backend",
          scope: "all_repformed_clients",
          rows,
          coaches: [],
          page:
            name === "staff_learning_roster_page"
              ? { ...common, next_cursor: null }
              : { ...common, number: 1, pages: 1, size: 25, coaches: [] },
        },
      });
    });
  }
  await context.route("**/rest/v1/rpc/learning_inbox", (r) =>
    r.fulfill({ json: [] }),
  );
  await context.route("**/rest/v1/rpc/learning_athlete", (r) =>
    r.fulfill({
      json: { can_submit: true, is_guardian: false, enrollments: [] },
    }),
  );
  return { calls, gate, data };
}
test("combined flags choose weekly roster and preserve athlete context without invoking the legacy pager", async ({
  page,
  context,
}) => {
  const f = await setup(context, true);
  await page.goto("./#workspace");
  await expect(page.getByRole("table")).toContainText("Fictional Jordan");
  expect(f.calls).toContain("staff_learning_roster_page");
  expect(f.calls).not.toContain("staff_client_service_roster_page");
  const search = page.getByRole("searchbox", {
    name: "Search athletes or clients",
  });
  await search.fill("Morgan");
  await expect(page.getByRole("table")).toContainText("Fictional Morgan");
  await expect(page.getByRole("table")).not.toContainText("Fictional Jordan");
  await page.getByRole("button", { name: /for Fictional Morgan/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Fictional Morgan");
  await page
    .getByRole("button", { name: "Back to athletes", exact: true })
    .click();
  await expect(search).toHaveValue("Morgan");
  expect(f.calls).not.toContain("staff_client_service_roster_page");
});
test("manual-only flag uses the numeric service pager and no weekly RPC", async ({
  page,
  context,
}) => {
  const f = await setup(context, false);
  await page.goto("./#workspace");
  await expect(page.getByRole("table")).toContainText("Fictional Jordan");
  expect(f.calls).toContain("staff_client_service_roster_page");
  expect(f.calls).not.toContain("staff_learning_roster_page");
});
test("delivery settings retain full scoped profile choices with both flags, not either first roster page", async ({
  page,
  context,
}) => {
  const f = await setup(context, true);
  await page.goto("./#staff-delivery");
  await expect(
    page.getByRole("heading", { name: "Keep delivery on track." }),
  ).toBeVisible();
  const picker = page.getByRole("combobox", { name: /Athlete/ });
  await expect(picker).toContainText("Fictional Jordan");
  await expect(picker).toContainText("Fictional Morgan");
  expect(f.calls).toContain("staff_client_service_roster");
  expect(f.calls).not.toContain("staff_client_service_roster_page");
  expect(f.calls).not.toContain("staff_learning_roster_page");
});
test("weekly capability errors fail closed rather than switching to manual or legacy rows", async ({
  page,
  context,
}) => {
  const f = await setup(context, true);
  f.gate.weeklyError = "PGRST202";
  await page.goto("./#workspace");
  await expect(page.getByRole("alert")).toContainText(
    "Weekly service records could not be loaded",
  );
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(f.calls).not.toContain("staff_client_service_roster_page");
  expect(f.calls).not.toContain("staff_client_service_roster");
});
test("pending weekly filters preserve their input, disable stale actions and settle without duplicate numeric navigation", async ({
  page,
  context,
}) => {
  const f = await setup(context, true);
  await page.goto("./#workspace");
  await expect(page.getByRole("table")).toContainText("Fictional Jordan");
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  f.gate.pause = () => held;
  await page
    .getByRole("searchbox", { name: "Search athletes or clients" })
    .fill("Avery");
  await expect(
    page.getByRole("button", { name: /for Fictional Jordan/ }),
  ).toBeDisabled();
  await expect(
    page.getByText("Loading matching athletes…", { exact: true }),
  ).toBeVisible();
  release();
  await expect(page.getByRole("table")).toContainText("Fictional Avery");
  await expect(page.getByRole("table")).not.toContainText("Fictional Jordan");
  await expect(
    page.getByRole("navigation", { name: "Athlete roster pages" }),
  ).toHaveCount(1);
  expect(f.calls).not.toContain("staff_client_service_roster_page");
  expect(f.data.rows[0].athlete_id).toBe(athleteA);
});

test("weekly initial load and cancelled debounce do not issue duplicate reads or leave refresh stuck", async ({
  page,
  context,
}) => {
  const f = await setup(context, true);
  await page.goto("./#workspace");
  await expect(page.getByRole("table")).toContainText("Fictional Jordan");
  await page.waitForTimeout(350);
  expect(
    f.calls.filter((x) => x === "staff_learning_roster_page"),
  ).toHaveLength(1);
  const search = page.getByRole("searchbox", {
    name: "Search athletes or clients",
  });
  await search.fill("Morgan");
  await search.fill("");
  await page.waitForTimeout(350);
  await expect(
    page.getByRole("button", { name: "Refresh client service", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("table")).toContainText("Fictional Jordan");
  expect(
    f.calls.filter((x) => x === "staff_learning_roster_page"),
  ).toHaveLength(1);
});
