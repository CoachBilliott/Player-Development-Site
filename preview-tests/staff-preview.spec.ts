import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
    .getByRole("button", { name: "Open Fictional Jordan service", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Follow up overdue review",
  );
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
    .getByRole("button", { name: "Open Fictional Jordan service", exact: true })
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
