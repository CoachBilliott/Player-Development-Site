import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { staffFixture, staffState, coachA } from "./staffServiceFixture";
import { uid } from "./workoutFixture";
import { fixture as videoFixture } from "./videoReviewFixture";
import { mockProject } from "./contentFixture";

test("app login removes the duplicate support row and keeps header help keyboard reachable", async ({
  page,
  context,
}) => {
  await mockProject(context, new Map());
  await page.goto("./?source=app#account");
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "App help & support", exact: true }),
  ).toHaveCount(0);
  const help = page
    .getByRole("banner")
    .getByRole("link", { name: "App help", exact: true });
  await expect(help).toBeVisible();
  const a = await page.getByRole("banner").boundingBox(),
    b = await page.locator(".member-heading > .tag").boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Your app, explained." }),
  ).toBeVisible();
});

test("1000 athletes render in bounded pages; search, back and filter reset preserve exact context", async ({
  page,
  context,
}) => {
  const data = staffState(),
    row = data.rows[0];
  data.rows = Array.from({ length: 1000 }, (_, n) => ({
    ...row,
    athlete_id: uid(2000 + n),
    athlete_name: `Fictional Athlete ${String(n).padStart(4, "0")}`,
    pending_reviews: 0,
    overdue_reviews: 0,
    review_tasks: [],
  }));
  await staffFixture(context, data);
  await page.goto("./?source=app#workspace");
  const table = page.getByRole("table", {
    name: "Athlete roster, ordered by service priority",
  });
  await expect(table.locator("tbody tr")).toHaveCount(25);
  await expect(
    page.getByText("Showing 1–25 of 1000 matching records", { exact: true }),
  ).toBeVisible();
  const pages = page.getByRole("navigation", { name: "Athlete roster pages" });
  await expect(
    pages.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled();
  await pages.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByText("Showing 26–50 of 1000 matching records", { exact: true }),
  ).toBeFocused();
  await table.getByRole("button", { name: /Fictional Athlete 0025/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Fictional Athlete 0025",
  );
  await page.getByRole("button", { name: "Back to athletes" }).click();
  await expect(
    table.getByRole("button", { name: /Fictional Athlete 0025/ }),
  ).toBeFocused();
  await expect(page.getByText("Page 2 of 40", { exact: true })).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search athletes or clients" })
    .fill("0999");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("Fictional Athlete 0999");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.getByText("Page 1 of 40", { exact: true })).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search athletes or clients" })
    .fill("no-such-athlete");
  await expect(
    page.getByRole("heading", { name: "No matching athletes." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset search and filters" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(25);
  expect(await page.locator("button").count()).toBeLessThan(40);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("overdue review is the Owner's primary next action while assignment remains secondary", async ({
  page,
  context,
}) => {
  await staffFixture(context, staffState());
  await page.goto("./?source=app#workspace");
  await page
    .getByRole("button", { name: /Review overdue task for Fictional Jordan/ })
    .click();
  const next = page.getByRole("region", { name: "Next service action" });
  await expect(
    next.getByRole("link", { name: "Open review queue" }),
  ).toHaveClass("button");
  await expect(
    next.getByRole("button", { name: "Assign training", exact: true }),
  ).toHaveClass(/secondary/);
  await expect(next.locator(".actions > :first-child")).toHaveText(
    "Open review queue",
  );
  await page.getByRole("button", { name: "Back to athletes" }).click();
});

for (const role of ["owner", "manager", "coach"] as const)
  test(`${role} review empty state names current staff permissions without granting extra access`, async ({
    page,
    context,
  }) => {
    const backend = await videoFixture(context, role);
    backend.rows.length = 0;
    await page.goto("./?source=app#video-reviews");
    await expect(
      page.getByText(
        /An Owner enables video review and assigns its review coach through Training/,
      ),
    ).toBeVisible();
    const link = page.getByRole("link", {
      name: "Open individual lesson & review permissions",
    });
    if (role === "owner") {
      await expect(link).toHaveAttribute("href", /#training-access$/);
      await link.click();
      await expect(
        page.getByRole("heading", { name: "Lesson & review access." }),
      ).toBeVisible();
    } else await expect(link).toHaveCount(0);
  });

test("paged coach roster never includes another coach's athlete", async ({
  page,
  context,
}) => {
  const data = staffState();
  await staffFixture(context, data, "coach", coachA);
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("button", { name: /Fictional Jordan/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Fictional Avery|Fictional Morgan/ }),
  ).toHaveCount(0);
});

test("roster last page is bounded and a smaller refreshed scope cannot leave a blank stale page", async ({
  page,
  context,
}) => {
  const data = staffState(),
    row = data.rows[0];
  data.rows = Array.from({ length: 31 }, (_, n) => ({
    ...row,
    athlete_id: uid(4000 + n),
    athlete_name: `Fictional Page ${String(n).padStart(2, "0")}`,
  }));
  await staffFixture(context, data);
  await page.goto("./?source=app#workspace");
  const pages = page.getByRole("navigation", { name: "Athlete roster pages" });
  await pages.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByText("Showing 26–31 of 31 matching records", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".staff-service-table tbody tr")).toHaveCount(6);
  await expect(pages.getByRole("button", { name: "Next page" })).toBeDisabled();
  data.rows = data.rows.slice(0, 1);
  await page
    .getByRole("button", { name: "Refresh client service", exact: true })
    .click();
  await expect(page.locator(".staff-service-table tbody tr")).toHaveCount(1);
  await expect(
    page.getByText("Showing 1 of 1 matching records", { exact: true }),
  ).toBeVisible();
  await expect(pages).toHaveCount(0);
});
