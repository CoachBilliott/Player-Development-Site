import { test, expect } from "@playwright/test";

test("field illustration responds to focus, replay, and pause without recording practice", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const shell = page.locator(".experience");
  await expect(shell).toHaveAttribute("data-motion", "running");
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(1);
  const route = await page.locator(".route-trace").getAttribute("d");
  await page.getByRole("button", { name: "Field vision", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Field vision", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("img", {
      name: /Original illustrative football field showing a path toward open space/,
    }),
  ).toBeVisible();
  expect(await page.locator(".route-trace").getAttribute("d")).not.toBe(route);
  await page.evaluate(() => document.fonts.ready);
  // A replay must restart even after the SVG document timeline has finished a route.
  await page.locator(".stadium-surface svg").evaluate((svg) => {
    (svg as SVGSVGElement).setCurrentTime(20);
  });
  await page.getByRole("button", { name: "Replay field animation" }).click();
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(1);
  const marker = page.locator(".field-activity circle");
  const firstPosition = await marker.boundingBox();
  if (!firstPosition) throw new Error("The animated field marker is missing.");
  await expect
    .poll(async () => {
      const current = await marker.boundingBox();
      return current
        ? Math.hypot(current.x - firstPosition.x, current.y - firstPosition.y)
        : 0;
    })
    .toBeGreaterThan(16);
  await page
    .getByRole("button", { name: "Motion on: pause animations", exact: true })
    .click();
  await expect(shell).toHaveAttribute("data-motion", "paused");
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Replay field animation" }),
  ).toBeDisabled();
  expect(
    await page
      .locator(".stadium-surface")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.reload();
  await expect(shell).toHaveAttribute("data-motion", "paused");
  expect(
    await page.evaluate(() => localStorage.getItem("pd-demo-v1")),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Motion off: play animations", exact: true })
    .click();
  await expect(shell).toHaveAttribute("data-motion", "running");
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(1);
  const reveal = page.locator(".reveal").last();
  await reveal.scrollIntoViewIfNeeded();
  await expect(reveal).toHaveAttribute("data-visible", "true");
});

test("device reduced motion gives a static, usable training experience", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect(
    page.getByRole("button", {
      name: "Motion off: reduced-motion preference",
    }),
  ).toBeDisabled();
  await expect(page.locator(".stadium-surface animateMotion")).toHaveCount(0);
  expect(
    await page
      .locator(".stadium-surface")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  for (const reveal of await page.locator(".reveal").all())
    expect(await reveal.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1",
    );
  await page
    .getByRole("main")
    .getByRole("link", { name: "Try the demo", exact: true })
    .click();
  await page.getByRole("button", { name: /Morgan/ }).click();
  await page.getByRole("button", { name: "See my training" }).click();
  await expect(
    page.getByRole("heading", { name: "Today’s training", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start today’s session" }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Begin guided session" }).click();
  await expect(
    page.getByRole("button", { name: "Show practice steps" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".page-transition")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Show practice steps" }),
  ).toBeVisible();
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-motion",
    "paused",
  );
});

test("3D football rotates on demand, freezes with motion off, and survives navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const artwork = page.locator(".football-art");
  await expect(artwork).toHaveAttribute("data-renderer", "ready", {
    timeout: 15000,
  });
  const canvas = page.getByRole("img", {
    name: /Original interactive 3D football artwork/,
  });
  await expect(canvas).toBeVisible();
  await page
    .getByRole("button", { name: "Motion on: pause animations", exact: true })
    .click();
  const initial = await canvas.screenshot();
  expect((await canvas.screenshot()).equals(initial)).toBe(true);
  await page.getByRole("button", { name: "Rotate football left" }).click();
  await expect(page.locator(".football-canvas")).toHaveAttribute(
    "data-view",
    "-45",
  );
  const rotated = await canvas.screenshot();
  expect(rotated.equals(initial)).toBe(false);
  expect((await canvas.screenshot()).equals(rotated)).toBe(true);
  await page.getByRole("button", { name: "Rotate football right" }).dblclick();
  await expect(page.locator(".football-canvas")).toHaveAttribute(
    "data-view",
    "45",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("pd-demo-v1")),
  ).toBeNull();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Try the demo", exact: true })
    .click();
  await expect(page.locator(".football-canvas canvas")).toHaveCount(0);
  await page.goBack();
  await expect(artwork).toHaveAttribute("data-renderer", "ready", {
    timeout: 15000,
  });
  await expect(page.locator(".football-canvas canvas")).toHaveCount(1);
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-motion",
    "paused",
  );
});

test("phones without WebGL retain original artwork and a working demo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (
        kind === "webgl" ||
        kind === "webgl2" ||
        kind === "experimental-webgl"
      )
        return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await page.goto("./");
  await expect(page.locator(".football-art")).toHaveAttribute(
    "data-renderer",
    "fallback",
  );
  await expect(
    page.getByRole("img", { name: "Original football artwork", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rotate football left" }),
  ).toBeDisabled();
  await expect(page.locator(".football-canvas canvas")).toHaveCount(0);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Try the demo", exact: true })
    .click();
  await page.getByRole("button", { name: /Morgan/ }).click();
  await page.getByRole("button", { name: "See my training" }).click();
  await expect(
    page.getByRole("heading", { name: "Today’s training", level: 1 }),
  ).toBeVisible();
});

test("graphics context loss falls back without blocking the page", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".football-art")).toHaveAttribute(
    "data-renderer",
    "ready",
    { timeout: 15000 },
  );
  await page.locator(".football-canvas canvas").evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("webgl2");
    const extension = context?.getExtension("WEBGL_lose_context");
    if (!extension)
      throw new Error(
        "Test browser must support deliberate graphics context loss.",
      );
    extension.loseContext();
  });
  await expect(page.locator(".football-art")).toHaveAttribute(
    "data-renderer",
    "fallback",
  );
  await expect(
    page.getByRole("img", { name: "Original football artwork", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rotate football right" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "See how it works" }).click();
  await expect(
    page.getByRole("heading", { name: /A clear path from plan/ }),
  ).toBeInViewport();
});
