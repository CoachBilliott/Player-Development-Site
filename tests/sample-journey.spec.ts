import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";

test.beforeEach(async ({ context, page }) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
});
async function answerQuiz(
  page: import("@playwright/test").Page,
  correct = true,
) {
  await page.getByRole("button", { name: "2 Take the quiz" }).click();
  await page
    .getByRole("group", { name: /^1\./ })
    .getByLabel(correct ? "The goal lines" : "The halfway line", {
      exact: true,
    })
    .check();
  await page.getByLabel("The sidelines", { exact: true }).last().check();
  await page.getByRole("button", { name: "Check sample answers" }).dblclick();
}
test("sample presents media gaps honestly and never writes private progress or submits interest", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(r.method()))
      writes.push(r.url());
  });
  await page.goto("./#sample-week");
  await expect(
    page.getByRole("heading", { name: "One lesson. A clearer next step." }),
  ).toBeVisible();
  await expect(page.getByLabel("Preview limits")).toContainText(
    "not a complete package week",
  );
  await expect(
    page.getByText("Lesson video not provided", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark sample lesson read & take quiz" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Take the quiz", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("group", { name: /^1\./ })
    .getByLabel("The goal lines", { exact: true })
    .check();
  await page.getByLabel("The sidelines", { exact: true }).last().check();
  await page.getByRole("button", { name: "Check sample answers" }).click();
  await expect(
    page.getByRole("heading", { name: "Sample result: 2 / 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next: Practice format" }).click();
  await expect(
    page.getByText("Reviewed drill demonstration not provided", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("No practice is assigned here.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View sample progress" }).click();
  const progress = page.getByLabel("Sample progress");
  await expect(progress).toContainText("Marked read in this page");
  await expect(progress).toContainText("1 sample attempt; latest 2 / 2");
  await expect(progress).toContainText("Format viewed; no practice completed");
  await expect(progress).toContainText("No coaching assessment");
  await page
    .getByRole("link", { name: "Compare packages", exact: true })
    .click();
  await expect(page).toHaveURL(/#membership$/);
  expect(writes).toEqual([]);
});
test("quiz requires all answers, double submit creates one attempt and retake preserves history", async ({
  page,
}) => {
  await page.goto("./#sample-week");
  await page.getByRole("button", { name: "2 Take the quiz" }).click();
  await page.getByRole("button", { name: "Check sample answers" }).click();
  await expect(
    page.getByRole("heading", { name: /Sample result/ }),
  ).toHaveCount(0);
  await answerQuiz(page, false);
  await expect(
    page.getByRole("heading", { name: "Sample result: 1 / 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try sample quiz again" }).click();
  await answerQuiz(page);
  await page.getByRole("button", { name: "4 Progress & feedback" }).click();
  await expect(page.getByLabel("Sample progress")).toContainText(
    "2 sample attempts; latest 2 / 2",
  );
  await expect(page.getByLabel("Sample progress")).toContainText(
    "Not marked read",
  );
  await page.getByText("Sample attempt history", { exact: true }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: /^Attempt/ }),
  ).toHaveText(["Attempt 1: 1 / 2", "Attempt 2: 2 / 2"]);
});
test("unfinished answers resume between steps without claiming completion", async ({
  page,
}) => {
  await page.goto("./#sample-week");
  await page.getByRole("button", { name: "2 Take the quiz" }).click();
  const first = page
    .getByRole("group", { name: /^1\./ })
    .getByLabel("The goal lines", { exact: true });
  await first.check();
  await page.getByRole("button", { name: "4 Progress & feedback" }).click();
  await expect(page.getByLabel("Sample progress")).toContainText(
    "Not submitted",
  );
  await expect(page.getByLabel("Sample progress")).toContainText(
    "Not marked read",
  );
  await page.getByRole("button", { name: "2 Take the quiz" }).click();
  await expect(first).toBeChecked();
  await expect(
    page
      .getByRole("group", { name: /^2\./ })
      .getByRole("radio", { checked: true }),
  ).toHaveCount(0);
});
test("cancel reset keeps work, confirmed reset and reload clear only local sample state", async ({
  page,
}) => {
  await page.goto("./#sample-week");
  await answerQuiz(page);
  await page.getByRole("button", { name: "Reset sample", exact: true }).click();
  await page.getByRole("button", { name: "Keep my sample" }).click();
  await expect(
    page.getByRole("button", { name: "Reset sample", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Sample result: 2 / 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset sample", exact: true }).click();
  await page.getByRole("button", { name: "Clear sample progress" }).click();
  await expect(
    page.getByRole("heading", { name: "IQ lesson", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "4 Progress & feedback" }).click();
  await expect(page.getByLabel("Sample progress")).toContainText(
    "Not submitted",
  );
  await answerQuiz(page);
  await page.reload();
  await page.getByRole("button", { name: "4 Progress & feedback" }).click();
  await expect(page.getByLabel("Sample progress")).toContainText(
    "Not submitted",
  );
});
test("public links and browser history keep legacy practice available", async ({
  page,
}) => {
  await page.goto("./#customer-help");
  await page
    .getByRole("link", { name: "Open sample learning journey" })
    .click();
  await expect(page).toHaveURL(/#sample-week$/);
  await page.getByRole("button", { name: "4 Progress & feedback" }).click();
  await page
    .getByRole("link", { name: "Explore fictional family practice screens" })
    .click();
  await expect(page).toHaveURL(/#demo$/);
  await expect(
    page.getByRole("heading", { name: /Explore fictional practice/ }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#sample-week$/);
  await expect(
    page.getByRole("heading", { name: "IQ lesson", exact: true }),
  ).toBeVisible();
});
test("native-compatible app entry excludes public samples and keeps real auth gate", async ({
  page,
}) => {
  await page.goto("./?source=app#sample-week");
  await expect(page).toHaveURL(/#app$/);
  await expect(
    page.getByRole("heading", { name: "One lesson. A clearer next step." }),
  ).toHaveCount(0);
  await expect(page.locator(".app-header")).toBeVisible();
});
test("sample steps are keyboard accessible without overflow or sampled axe issues", async ({
  page,
}, info) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./#sample-week");
    for (let step = 0; step < 4; step++) {
      await page
        .getByRole("button", {
          name: `${step + 1} ${["IQ lesson", "Take the quiz", "Practice format", "Progress & feedback"][step]}`,
        })
        .focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#sample-step-title")).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const results = await new AxeBuilder({ page })
        .include(".sample-journey")
        .analyze();
      expect(results.violations).toEqual([]);
    }
    await page.screenshot({
      path: info.outputPath(`${width}-progress.png`),
      fullPage: true,
    });
  }
});
