import { test, expect } from "@playwright/test";
import { staffFixture, staffState, coachA } from "./staffServiceFixture";
import { staffId, uid } from "./workoutFixture";
const scenarios = [
  { label: "Owner", role: "owner", actor: staffId },
  { label: "Manager", role: "manager", actor: staffId },
  { label: "assigned Coach", role: "coach", actor: coachA },
  { label: "unassigned Coach", role: "coach", actor: uid(999) },
] as const;
for (const { label, role, actor } of scenarios) {
  test(`${label} roster header contains Refresh at small widths and keeps it usable`, async ({
    page,
    context,
  }, info) => {
    await staffFixture(context, staffState(), role, actor);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("./?source=app#workspace");
    const card = page.locator(".staff-service").first();
    const header = card.locator(".staff-service-heading");
    const refresh = header.getByRole("button", {
      name: "Refresh client service",
      exact: true,
    });
    await expect(card.locator(".staff-result-count")).toBeVisible();
    const athletes = role === "coach" ? (actor === coachA ? 1 : 0) : 3;
    const clients = role === "coach" ? athletes : 2;
    await expect(header.locator("p")).toContainText(
      `Athletes: ${athletes} · Clients: ${clients}`,
    );
    await expect(card.locator(".staff-result-count")).toContainText(
      `of ${athletes} matching ${athletes === 1 ? "record" : "records"}`,
    );
    if (athletes)
      await expect(
        card.getByText("1 review overdue", { exact: true }),
      ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 568 });
      const bounds = await card.evaluate((el) => {
        const card = el.getBoundingClientRect();
        const button = el
          .querySelector<HTMLButtonElement>(".staff-refresh")!
          .getBoundingClientRect();
        const text = el
          .querySelector<HTMLElement>(".staff-service-heading > div")!
          .getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          left: card.left + parseFloat(style.paddingLeft),
          right: card.right - parseFloat(style.paddingRight),
          buttonLeft: button.left,
          buttonRight: button.right,
          height: button.height,
          separate:
            button.right <= text.left ||
            button.left >= text.right ||
            button.bottom <= text.top ||
            button.top >= text.bottom,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(bounds.buttonLeft).toBeGreaterThanOrEqual(bounds.left - 1);
      expect(bounds.buttonRight).toBeLessThanOrEqual(bounds.right + 1);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.separate).toBe(true);
      expect(bounds.overflow).toBe(false);
      if (width === 320)
        await header.screenshot({
          path: info.outputPath("roster-header-320.png"),
        });
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await refresh.click();
    await expect(refresh).toBeEnabled();
    await expect(card.locator(".staff-result-count")).toBeVisible();
    await expect(
      header.getByRole("heading", { name: "Athlete roster", exact: true }),
    ).toBeVisible();
  });
}
