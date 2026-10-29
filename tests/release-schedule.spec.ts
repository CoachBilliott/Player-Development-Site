import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, state } from "./workoutFixture";
test("Owner previews Sunday clock changes, saves a device-only draft and discards edits without scheduling", async ({
  page,
  context,
}) => {
  const backend = state();
  await fixture(context, backend);
  await page.goto("./?source=app#launch");
  await expect(page.getByRole("main")).toContainText("two monthly reviews");
  await expect(page.getByRole("main")).toContainText(
    "no payments or review credits are active",
  );
  await expect(page.getByRole("main")).not.toContainText(
    "four reviews per child",
  );
  const panel = page.getByRole("region", { name: "Sunday release draft" });
  await expect(panel.getByLabel("Sunday release time")).toHaveValue("");
  await expect(panel.getByLabel("Business time zone")).toHaveValue("");
  await panel.getByLabel("Example Sunday").fill("2026-10-25");
  await panel.getByLabel("Sunday release time").fill("08:00");
  await panel.getByLabel("Business time zone").fill("America/Chicago");
  await panel.getByRole("button", { name: "Preview Sunday release" }).click();
  await expect(panel.getByRole("status")).toContainText(
    "2026-10-25T13:00:00.000Z",
  );
  await panel
    .getByRole("button", { name: "Save schedule draft on this device" })
    .dblclick();
  await expect(
    panel.getByText(
      "Schedule draft saved on this device. No schedule was activated.",
    ),
  ).toBeVisible();
  await page.reload();
  await expect(panel.getByLabel("Sunday release time")).toHaveValue("08:00");
  await panel.getByLabel("Example Sunday").fill("2026-11-01");
  await panel.getByRole("button", { name: "Preview Sunday release" }).click();
  await expect(panel.getByRole("status")).toContainText(
    "2026-11-01T14:00:00.000Z",
  );
  await panel.getByLabel("Sunday release time").fill("01:30");
  await panel.getByRole("button", { name: "Preview Sunday release" }).click();
  await expect(panel.getByRole("alert")).toContainText("occurs twice");
  await expect(
    panel.getByRole("button", { name: "Save schedule draft on this device" }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: "Discard schedule edits" }).click();
  await expect(panel.getByLabel("Example Sunday")).toHaveValue("2026-10-25");
  await expect(panel.getByLabel("Sunday release time")).toHaveValue("08:00");
  expect(backend.counts.assigns).toBe(0);
  expect(backend.counts.saves).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("coaches can read readiness but cannot configure the Owner schedule draft", async ({
  page,
  context,
}) => {
  await fixture(context, state(), "coach");
  await page.goto("./#launch");
  await expect(
    page.getByRole("heading", { name: "A clear path to opening day." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Sunday release draft" }),
  ).toHaveCount(0);
});
