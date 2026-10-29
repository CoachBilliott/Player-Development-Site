import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { disableBackend } from "./backendFixture";
import { fixture, state, staffId } from "./workoutFixture";

test.beforeEach(async ({ context, page }) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
});
async function interest(context: BrowserContext) {
  const requests: unknown[] = [];
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        interestIntakeEnabled: true,
      },
    }),
  );
  await context.route("https://separate-demo.supabase.co/**", (r) => {
    if (
      r.request().method() === "POST" &&
      r.request().url().includes("/functions/v1/interest-intake")
    )
      requests.push(r.request().postDataJSON());
    return r.fulfill({ json: [] });
  });
  return requests;
}

test("public navigation prioritizes interest and keeps member login available", async ({
  page,
}, info) => {
  await page.goto("./#home");
  await expect(page.locator(".header-account")).toHaveText("Express interest");
  if (info.project.name === "phone") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link", { name: "Log in", exact: true }),
    ).toHaveAttribute("href", "#account");
    await page.getByRole("button", { name: "Close navigation" }).click();
  } else await expect(page.locator(".header-login")).toBeVisible();
  await page.locator(".header-account").click();
  await expect(
    page.getByRole("heading", { name: "Interested? Tell us what fits." }),
  ).toBeFocused();
});

test("each package preselects interest without losing the adult draft, consent or sending", async ({
  page,
  context,
}, info) => {
  const requests = await interest(context);
  await page.goto("./#membership");
  const form = page.getByRole("form", { name: "Send adult package interest" });
  await form.getByLabel("Adult name").fill("Fictional Adult");
  await form.getByLabel("Adult email").fill("fictional-adult@example.test");
  await form.getByLabel("I’m 18 or older.").check();
  await expect(
    form.getByLabel("Email me when Repformed launches"),
  ).not.toBeChecked();
  for (const [id, name] of [
    ["foundation", "Foundation"],
    ["fundamentals", "Fundamentals"],
    ["position-development", "Position Development"],
    ["elite-coaching", "Elite Coaching"],
  ]) {
    await page
      .getByRole("button", { name: `Express interest in ${name}`, exact: true })
      .click();
    await expect(form.getByLabel("Package interest")).toHaveValue(id);
    await expect(
      page.getByRole("heading", { name: "Interested? Tell us what fits." }),
    ).toBeFocused();
    await expect(form.getByLabel("Adult name")).toHaveValue("Fictional Adult");
    await expect(form.getByLabel("Adult email")).toHaveValue(
      "fictional-adult@example.test",
    );
    await expect(form.getByLabel("I’m 18 or older.")).toBeChecked();
    await expect(
      form.getByLabel("Email me when Repformed launches"),
    ).not.toBeChecked();
  }
  await mkdir("artifacts/customer-journey", { recursive: true });
  await page
    .locator("#package-interest")
    .screenshot({
      path: `artifacts/customer-journey/selected-form-${info.project.name}.png`,
      style: "header,.app-tabs{visibility:hidden !important}",
    });
  await form.getByLabel("Email me when Repformed launches").check();
  await page
    .getByRole("button", {
      name: "Express interest in Foundation",
      exact: true,
    })
    .click();
  await expect(
    form.getByLabel("Email me when Repformed launches"),
  ).toBeChecked();
  await page.locator(".interest-email-fallback summary").click();
  await expect(page.getByLabel("Package you’re interested in")).toHaveValue(
    "foundation",
  );
  await page
    .getByLabel("Package you’re interested in")
    .selectOption("undecided");
  await expect(form.getByLabel("Package interest")).toHaveValue("undecided");
  await expect(page.locator(".interest-selection")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("unavailable intake selection prepares only its explicit email fallback", async ({
  page,
}) => {
  await page.goto("./#membership");
  await page
    .getByRole("button", {
      name: "Express interest in Elite Coaching",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Package you’re interested in")).toHaveValue(
    "elite-coaching",
  );
  const url = new URL(
    (await page
      .getByRole("link", { name: "Email package interest" })
      .getAttribute("href"))!,
  );
  expect(url.searchParams.get("body")).toContain(
    "Interested package: Elite Coaching",
  );
  await expect(page.locator("#package-interest")).toContainText(
    "This opens your email app",
  );
  await expect(
    page.getByRole("button", { name: "Send interest", exact: true }),
  ).toHaveCount(0);
});

test("customer help is current, customer-first and links the clearly historical archive", async ({
  page,
}) => {
  await page.goto("./#contact");
  await page.getByRole("link", { name: /Customer help Invitations/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Find your next step." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Invitations & sign-in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Invitations and sign-in", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("main")).toContainText(
    "Public enrollment and paid memberships are not open",
  );
  await page
    .getByText("Staff reference and historical guides", { exact: true })
    .click();
  await page
    .getByRole("link", {
      name: "Historical staff pilot walkthrough",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Historical guide" }),
  ).toContainText("build-10 screenshots");
  await expect(
    page.getByRole("link", { name: "Open current customer help" }),
  ).toHaveAttribute("href", "./#customer-help");
  const pdf = await page.request.get("./partner-guide.pdf");
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.goto("./account-help.html");
  const sections = await page
    .locator("main section[id]")
    .evaluateAll((nodes) => nodes.map((n) => n.id));
  expect(sections.indexOf("accept")).toBeLessThan(sections.indexOf("invite"));
  expect(sections.indexOf("retention")).toBeLessThan(
    sections.indexOf("invite"),
  );
  await expect(page.locator("#retention")).toContainText(
    "Provider backups, security records",
  );
  await expect(page.locator("#retention")).toContainText(
    "there is no automatic video expiry schedule",
  );
});

test("app help actions are separate and browser entry/account offer a clean website exit", async ({
  page,
  context,
}) => {
  await page.goto("./?source=app#app-help");
  const first = page.getByRole("link", {
    name: "View website membership information",
    exact: true,
  });
  const second = page.getByRole("link", {
    name: "Contact the team",
    exact: true,
  });
  const a = (await first.boundingBox())!,
    b = (await second.boundingBox())!;
  expect(a.height).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(a.x + a.width + 11 <= b.x || a.y + a.height + 11 <= b.y).toBe(true);
  await page.goto("./?source=app#app");
  await page.evaluate(() =>
    sessionStorage.setItem("fixture-app-draft", "preserved"),
  );
  await context.route("https://repformed.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<title>Fictional website destination</title>",
    }),
  );
  const exit = page
    .getByRole("link", { name: "Back to website", exact: true })
    .first();
  await expect(exit).toHaveAttribute("href", "https://repformed.com/#home");
  const popupPromise = page.waitForEvent("popup");
  await exit.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://repformed.com/#home");
  await popup.close();
  expect(
    await page.evaluate(() => sessionStorage.getItem("fixture-app-draft")),
  ).toBe("preserved");
  await page.goto("./?source=app#account");
  await expect(
    page.getByRole("link", { name: "Back to website", exact: true }),
  ).toHaveAttribute("href", "https://repformed.com/#home");
});

for (const role of ["owner", "manager", "coach", "parent", "athlete"]) {
  test(`${role} installation action respects its restored signed-in session`, async ({
    page,
    context,
  }) => {
    await fixture(context, state(), role, staffId, true);
    await page.goto("./#install");
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: "Open dashboard", exact: true }),
    ).toHaveAttribute("href", "#workspace");
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: "Log in to your account", exact: true }),
    ).toHaveCount(0);
  });
}

for (const route of [
  "./#customer-help",
  "./account-help.html",
  "./#membership",
]) {
  test(`${route} is readable at narrow widths and keyboard-accessible`, async ({
    page,
  }, info) => {
    await page.goto(route);
    const widths =
      info.project.name === "phone" ? [320, 375, 390] : [768, 1440];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await mkdir("artifacts/customer-journey", { recursive: true });
    await page.screenshot({
      path: `artifacts/customer-journey/${route.includes("account-help") ? "account-help" : route.includes("membership") ? "packages" : "customer-help"}-${info.project.name}.png`,
      fullPage: true,
    });
  });
}

test("a pending or received request cannot silently change packages", async ({
  page,
  context,
}) => {
  await interest(context);
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  let sends = 0;
  await context.route(
    "https://separate-demo.supabase.co/functions/v1/interest-intake",
    async (r) => {
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "POST, OPTIONS",
      };
      if (r.request().method() === "OPTIONS")
        return r.fulfill({ status: 204, headers });
      sends++;
      await gate;
      return r.fulfill({
        status: 202,
        headers,
        json: { status: "accepted", reference: r.request().postDataJSON().id },
      });
    },
  );
  await page.goto("./#membership");
  const form = page.getByRole("form", { name: "Send adult package interest" });
  await page
    .getByRole("button", {
      name: "Express interest in Elite Coaching",
      exact: true,
    })
    .click();
  await form.getByLabel("Adult email").fill("fictional-adult@example.test");
  await form.getByLabel("I’m 18 or older.").check();
  await form
    .getByRole("button", { name: "Send interest", exact: true })
    .click();
  for (const button of await page
    .getByRole("button", { name: /Express interest in / })
    .all())
    await expect(button).toBeDisabled();
  await expect(form.getByLabel("Package interest")).toHaveValue(
    "elite-coaching",
  );
  await expect(page.locator(".interest-selection")).toHaveCount(0);
  release();
  await expect(page.locator(".interest-received")).toContainText(
    "Interest received",
  );
  expect(sends).toBe(1);
  for (const button of await page
    .getByRole("button", { name: /Express interest in / })
    .all())
    await expect(button).toBeDisabled();
});
