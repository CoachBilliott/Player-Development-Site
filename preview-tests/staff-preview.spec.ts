import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
test("isolated preview has usable scoped roles, details, assignment, reset and no external API", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:5175")) external.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByText("INTERACTIVE PREVIEW · FICTIONAL ADULTS ONLY"),
  ).toBeVisible();
  await expect(
    page.getByText("Fictional Avery", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Review overdue task for Fictional Jordan",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Follow up overdue review",
  );
  await page
    .getByRole("dialog")
    .locator("summary")
    .filter({ hasText: "Service coach" })
    .click();
  await page.getByLabel("Responsible service coach").selectOption("");
  await page.getByRole("button", { name: "Save service coach" }).click();
  await page.getByRole("button", { name: "Back to client service" }).click();
  await page.getByLabel("View as").selectOption("coach");
  await expect(
    page.getByText("No athletes assigned to you yet.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset fictional data" }).click();
  await expect(
    page.getByText("Fictional Jordan", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Fictional Avery", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("View as").selectOption("manager");
  await expect(
    page.getByText("Fictional Avery", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Review overdue task for Fictional Jordan",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Save service coach" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Back to client service" }).click();
  await page.reload();
  await expect(page.getByLabel("View as")).toHaveValue("owner");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(external).toEqual([]);
});

test("action-first roster search, status filters, no results and keyboard/back preserve context", async ({
  page,
}, info) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Client service dashboard" }),
    search = panel.getByRole("searchbox", {
      name: "Search athletes or clients",
    }),
    filter = panel.getByLabel("Show service records");
  await expect(
    panel.getByText("Fictional Morgan", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "1 Overdue", exact: true }).click();
  await expect(panel.getByText("Fictional Avery", { exact: true })).toHaveCount(
    0,
  );
  await panel
    .getByRole("button", { name: "1 Needs attention", exact: true })
    .click();
  await expect(
    panel.getByRole("button", {
      name: "Assign service coach for Fictional Morgan",
      exact: true,
    }),
  ).toBeVisible();
  await filter.selectOption("ready");
  await expect(
    panel.getByText("Fictional Avery", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Fictional Jordan", { exact: true }),
  ).toHaveCount(0);
  await filter.selectOption("unassigned");
  await expect(
    panel.getByText("Fictional Morgan", { exact: true }),
  ).toBeVisible();
  await search.fill("No such athlete");
  await expect(
    panel.getByRole("heading", { name: "No matching athletes." }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Reset search and filters" }).click();
  await expect(search).toHaveValue("");
  await expect(filter).toHaveValue("all");
  await search.fill("aVeRy bLaIr");
  await expect(
    panel.getByText("Fictional Avery", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Fictional Jordan", { exact: true }),
  ).toHaveCount(0);
  const action = panel.getByRole("button", {
    name: "View athlete details for Fictional Avery",
    exact: true,
  });
  await action.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(search).toHaveValue("aVeRy bLaIr");
  await expect(filter).toHaveValue("all");
  await search.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(action).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(action).toBeFocused();
  await panel.getByRole("button", { name: "Clear filters" }).click();
  await mkdir("docs/staff-service-preview/polish", { recursive: true });
  await page.screenshot({
    path: `docs/staff-service-preview/polish/overview-${info.project.name}.png`,
    fullPage: true,
  });
  await panel
    .getByRole("button", {
      name: "Assign service coach for Fictional Morgan",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Responsible service coach")).toBeVisible();
  await page.screenshot({
    path: `docs/staff-service-preview/polish/detail-${info.project.name}.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Back to client service" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
