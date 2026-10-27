import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  staffFixture,
  staffState,
  coachA,
  coachB,
  athleteA,
  athleteB,
} from "./staffServiceFixture";
import { mkdir } from "node:fs/promises";
test("Owner landing shows all clients, overdue service and private athlete drilldown with honest telemetry", async ({
  page,
  context,
}, info) => {
  const data = staffState();
  await staffFixture(context, data);
  await page.goto("./?source=app#workspace");
  const panel = page.getByRole("region", { name: "Client service dashboard" });
  await expect(
    panel.getByText("Fictional Jordan", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Fictional Avery", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Fictional Morgan", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Follow up overdue review", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText("Purchase: not recorded")).toHaveCount(3);
  await mkdir("docs/staff-service-preview", { recursive: true });
  await page.screenshot({
    path: `docs/staff-service-preview/owner-${info.project.name}.png`,
    fullPage: false,
  });
  if (info.project.name === "phone") {
    await panel.locator("tbody tr").first().evaluate((row) =>
      row.scrollIntoView({ block: "start" }),
    );
    await page.screenshot({
      path: "docs/staff-service-preview/owner-roster-phone.png",
      fullPage: false,
    });
  }
  await page
    .getByRole("button", { name: "Open Fictional Jordan service", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await expect(d).toContainText("Follow up overdue review");
  await d.getByText("Purchase and access details", { exact: true }).click();
  await expect(d).toContainText("No connected purchase/payment record");
  await expect(d).toContainText("Activity opened: Not observed");
  await page.screenshot({
    path: `docs/staff-service-preview/athlete-detail-${info.project.name}.png`,
    fullPage: false,
  });
  await d.getByRole("button", { name: "Back to client service" }).click();
  await expect(d).toHaveCount(0);
  expect(page.url()).not.toContain("serviceAthlete");
  await page.goto("./#workspace");
  await expect(
    page
      .getByRole("region", { name: "Client service dashboard" })
      .getByText("Fictional Jordan", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/staff-service-preview/owner-website-${info.project.name}.png`,
    fullPage: false,
  });

  await panel.getByLabel("Show service records").selectOption("overdue");
  await expect(panel.getByText("Fictional Avery", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    panel.getByText("Fictional Jordan", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("Manager sees all clients read-only; Coach sees assigned athlete and direct sibling URL is denied", async ({
  page,
  context,
  browser,
}, info) => {
  const data = staffState();
  await staffFixture(context, data, "manager");
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByText("Fictional Morgan", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open Fictional Jordan service" })
    .click();
  await expect(
    page.getByRole("button", { name: "Save service coach" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Back to client service" }).click();
  await page.screenshot({
    path: `docs/staff-service-preview/manager-${info.project.name}.png`,
    fullPage: false,
  });
  const coachContext = await browser.newContext({
    viewport: page.viewportSize() || { width: 390, height: 844 },
  });
  await staffFixture(coachContext, data, "coach", coachA);
  const coach = await coachContext.newPage();
  await coach.goto(new URL("./?source=app#workspace", page.url()).href);
  await expect(
    coach.getByText("Fictional Jordan", { exact: true }),
  ).toBeVisible();
  await expect(coach.getByText("Fictional Avery", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    coach.getByText("fictional-family@example.test", { exact: true }),
  ).toHaveCount(0);
  await coach.screenshot({
    path: `docs/staff-service-preview/coach-${info.project.name}.png`,
    fullPage: false,
  });
  await coach.goto(
    new URL(`./?source=app&serviceAthlete=${athleteB}#workspace`, page.url())
      .href,
  );
  await expect(coach.getByRole("dialog").getByRole("alert")).toContainText(
    "outside your service roster",
  );
  await expect(coach.getByRole("dialog")).not.toContainText("Fictional Avery");
  await coach.getByRole("button", { name: "Back to client service" }).click();
  data.rows.find((r) => r.athlete_id === athleteA)!.coach_id = coachB;
  await coach.getByRole("button", { name: "Refresh client service" }).click();
  await expect(
    coach.getByText("No athletes assigned to you yet.", { exact: false }),
  ).toBeVisible();
  await coachContext.close();
});
