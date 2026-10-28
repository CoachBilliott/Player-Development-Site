import { expect, test } from "@playwright/test";
import { disableBackend } from "./backendFixture";

test("owner-verified social links are available on the website, Contact, app help and online guides", async ({
  page,
  context,
}) => {
  await disableBackend(context);
  const links = [
    ["Instagram", "https://www.instagram.com/repformed/"],
    ["TikTok", "https://www.tiktok.com/@repformed"],
    ["Facebook", "https://www.facebook.com/Repformed/"],
    ["X", "https://x.com/Repformed"],
    ["YouTube", "https://www.youtube.com/@repformed"],
  ];
  for (const path of [
    "./#home",
    "./#contact",
    "./?source=app#app-help",
    "./account-help.html",
    "./partner-guide.html",
    "./phone-test.html",
    "./credits.html",
  ]) {
    await page.goto(path);
    const nav = page
      .getByRole("navigation", { name: "Official social accounts" })
      .first();
    await expect(nav.getByRole("link")).toHaveCount(links.length);
    for (const [name, href] of links) {
      const link = nav.getByRole("link", {
        name: `${name} (opens outside Repformed)`,
      });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("homepage copy stays concise while licensed imagery credits remain reachable", async ({
  page,
  context,
}) => {
  await disableBackend(context);
  await page.goto("./#home");
  await expect(
    page.locator(".training-film-credit, .program-media-note"),
  ).toHaveCount(0);
  await expect(page.locator("footer")).not.toContainText(
    /scholarship|outcomes guaranteed|qualified coaching review/i,
  );
  const availability = page.locator(".hero .home-availability");
  await expect(availability).toBeVisible();
  await expect(availability).toContainText("Prelaunch.");
  await expect(availability).toContainText("Membership enrollment is not open");
  await expect(page.locator('.hero a[href="#demo"]')).toHaveCount(0);
  await page
    .locator("footer")
    .getByRole("link", { name: "Credits & licenses" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Credits & licenses." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Pexels License", exact: true }),
  ).toHaveAttribute("href", "https://www.pexels.com/license/");
  await expect(
    page.getByText("The website uses licensed stock photography", {
      exact: false,
    }),
  ).toBeVisible();
});
