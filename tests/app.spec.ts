import { disableBackend } from "./backendFixture";
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fixture, state, staffId } from "./workoutFixture";
import { resolve, extname } from "node:path";

async function updateServer() {
  let newer = false;
  const dist = resolve("dist");
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://localhost");
      const filename = resolve(
        dist,
        `.${url.pathname === "/" ? "/index.html" : url.pathname}`,
      );
      if (!filename.startsWith(dist + "/")) {
        response.writeHead(403);
        response.end();
        return;
      }
      let data: Buffer | string = await readFile(filename);
      if (url.pathname === "/sw.js" && newer)
        data = data
          .toString()
          .replace(
            /^const CACHE = .+;$/m,
            "const CACHE = `${PREFIX}test-new-version`;",
          );
      const types: Record<string, string> = {
        ".js": "application/javascript",
        ".html": "text/html",
        ".css": "text/css",
        ".webmanifest": "application/manifest+json",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
      };
      response.writeHead(200, {
        "Content-Type": types[extname(filename)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server did not start");
  return {
    url: `http://127.0.0.1:${address.port}/#install`,
    publish: () => {
      newer = true;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

test.beforeEach(async ({ context }) => {
  await disableBackend(context);
});

test("installed-app shell reopens offline and saves completed sample practice", async ({
  page,
  context,
}) => {
  await page.goto("./#install");
  await expect(
    page.getByRole("heading", { name: "Add it to your phone." }),
  ).toBeVisible();
  await expect(page.locator(".app-cache-status")).toContainText(
    "ready for offline use",
    { timeout: 20000 },
  );
  await expect(page.getByText("An app update is ready.")).toHaveCount(0);
  await expect(
    page.getByText("An update was applied in another tab."),
  ).toHaveCount(0);
  const manifest = await (
    await page.request.get("./manifest.webmanifest")
  ).json();
  expect(manifest.scope).toBe("./");
  expect(manifest.display).toBe("standalone");
  expect(manifest.name).toBe("Repformed");
  expect(manifest.theme_color).toBe("#181818");
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toContain(
    "512x512",
  );
  const cached = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter((key) =>
      key.startsWith("pd-shell-"),
    );
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map((request) => request.url),
        ),
      )
    ).flat();
  });
  expect(cached.some((url) => url.endsWith("/index.html"))).toBe(true);
  expect(cached.some((url) => url.endsWith("/brand/repformed-mark.svg"))).toBe(
    true,
  );
  expect(cached.some((url) => url.endsWith("/media/training-poster.jpg"))).toBe(
    true,
  );
  expect(cached.some((url) => url.endsWith("/media/family-football.jpg"))).toBe(
    true,
  );
  expect(cached.some((url) => url.endsWith("/media/solo-football.jpg"))).toBe(
    true,
  );
  expect(
    cached.some((url) =>
      url.endsWith("/media/repformed-horizontal-football-field.webp"),
    ),
  ).toBe(true);
  expect(cached.some((url) => /training-loop\.(mp4|webm)$/.test(url))).toBe(
    false,
  );
  expect(
    cached.some(
      (url) =>
        url.includes("content-config") ||
        url.includes("/auth/") ||
        url.includes("/storage/"),
    ),
  ).toBe(false);
  await context.setOffline(true);
  await page.goto("./#onboarding");
  expect(
    await page
      .locator(".header .brand-mark")
      .evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
  ).toBe(true);
  await expect(page.getByText(/You’re offline/)).toBeVisible();
  await page.getByRole("button", { name: /Morgan/ }).click();
  await page.getByRole("button", { name: "See my training" }).click();
  await page.getByRole("button", { name: "Start today’s session" }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Begin guided session" }).click();
  for (;;) {
    await expect(
      page.getByRole("button", { name: "Show practice steps" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show practice steps" }).click();
    await page.getByRole("checkbox").check();
    const finish = page.getByRole("button", { name: "Finish & reflect" });
    if (await finish.isVisible()) {
      await finish.click();
      break;
    }
    await page.getByRole("button", { name: "Next drill" }).click();
  }
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Record completed practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Practice progress", exact: true }),
  ).toBeVisible();
  await page.reload();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pd-demo-v1")!).history.length,
    ),
  ).toBe(1);
  await page.goto("./#install");
  await expect(page.locator(".app-cache-status")).toContainText(
    "ready for offline use",
  );
  await context.setOffline(false);
});

test("canceling an offered installation keeps the website usable", async ({
  page,
}) => {
  await page.goto("./#install");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Install app", exact: true }).click();
  await expect(
    page.getByText("Installation canceled. You can keep using the website."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Add it to your phone." }),
  ).toBeVisible();
});

test("the installed app reopens offline without exposing demo or private records", async ({
  page,
  context,
}) => {
  await page.goto("./?source=app#install");
  await expect(page.locator(".app-cache-status")).toContainText(
    "ready for offline use",
    { timeout: 20000 },
  );
  await context.setOffline(true);
  await page.goto("./?source=app#app");
  await expect(
    page.getByRole("heading", { name: "Your training starts here." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "App navigation" }),
  ).toBeVisible();
  await expect(page.locator('a[href="#demo"]')).toHaveCount(0);
  await expect(
    page.getByText(
      "Private workouts, profiles and video uploads need a connection.",
      { exact: false },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("pd-family-demo-v1")),
  ).toBeNull();
  await context.setOffline(false);
});

test("the approved About field remains available on a first offline visit", async ({
  page,
  context,
}) => {
  await page.goto("./#install");
  await expect(page.locator(".app-cache-status")).toContainText(
    "ready for offline use",
    { timeout: 20000 },
  );
  await context.setOffline(true);
  await page.goto("./#home");
  const field = page.getByRole("img", {
    name: "Repformed-branded football field illustration",
    exact: true,
  });
  await field.scrollIntoViewIfNeeded();
  await expect
    .poll(() => field.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1672);
  await context.setOffline(false);
});

test("a real waiting service-worker update waits for confirmation and preserves saved data", async ({
  page,
}) => {
  const server = await updateServer();
  try {
    await page.goto(server.url);
    await expect(page.locator(".app-cache-status")).toContainText(
      "ready for offline use",
      { timeout: 20000 },
    );
    await page.evaluate(() =>
      localStorage.setItem("pd-update-check", "preserved"),
    );
    let reloads = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) reloads++;
    });
    server.publish();
    await page.getByRole("button", { name: "Check for updates" }).click();
    await expect(page.getByText("An app update is ready.")).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole("button", { name: "Update app", exact: true }).click();
    await page.getByRole("button", { name: "Keep current version" }).click();
    expect(reloads).toBe(0);
    await page.getByRole("button", { name: "Update app", exact: true }).click();
    await page.getByRole("button", { name: "Reload and update" }).click();
    await expect.poll(() => reloads).toBeGreaterThan(0);
    await expect(page.locator(".app-cache-status")).toContainText(
      "ready for offline use",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("pd-update-check")),
    ).toBe("preserved");
    await expect(page.getByText("An app update is ready.")).toHaveCount(0);
  } finally {
    await server.close();
  }
});

test("another tab's update preserves unsaved work and offers a working confirmed reload", async ({
  page,
  context,
}, info) => {
  await fixture(context, state(), "owner", staffId, true);
  const server = await updateServer();
  const other = await context.newPage();
  try {
    for (const tab of [page, other]) {
      await tab.goto(server.url);
      await expect(tab.locator(".app-cache-status")).toContainText(
        "ready for offline use",
        { timeout: 20000 },
      );
      await expect(
        tab
          .locator(".header")
          .getByRole("link", { name: "Dashboard", exact: true }),
      ).toBeVisible();
    }
    await other.evaluate(() => {
      Object.assign(window, { unsavedPractice: "unsaved fictional note" });
      localStorage.setItem("pd-update-check", "preserved");
    });
    let otherReloads = 0;
    other.on("framenavigated", (frame) => {
      if (frame === other.mainFrame()) otherReloads++;
    });
    server.publish();
    await page.getByRole("button", { name: "Check for updates" }).click();
    for (const tab of [page, other])
      await expect(tab.getByText("An app update is ready.")).toBeVisible({
        timeout: 20000,
      });
    // A confirmation opened before another tab activates must remain cancellable.
    await other
      .getByRole("button", { name: "Update app", exact: true })
      .click();
    await page.getByRole("button", { name: "Update app", exact: true }).click();
    await page.getByRole("button", { name: "Reload and update" }).click();
    await expect(page.getByText("An app update is ready.")).toHaveCount(0);
    await expect(
      other.getByText("An update was applied in another tab."),
    ).toBeVisible();
    await expect(other.getByText("An app update is ready.")).toHaveCount(0);
    await other.getByRole("button", { name: "Keep current version" }).click();
    await expect(
      other.getByRole("button", { name: "Reload this tab", exact: true }),
    ).toBeVisible();
    expect(otherReloads).toBe(0);
    expect(
      await other.evaluate(() => Reflect.get(window, "unsavedPractice")),
    ).toBe("unsaved fictional note");
    await mkdir("artifacts/public-ux-fixes", { recursive: true });
    await other.screenshot({
      path: `artifacts/public-ux-fixes/other-tab-${info.project.name}.png`,
      fullPage: true,
    });
    await other
      .getByRole("button", { name: "Reload this tab", exact: true })
      .click();
    await expect(other.getByRole("dialog")).toContainText(
      "Unsaved device work may be lost",
    );
    await other.getByRole("button", { name: "Reload and update" }).click();
    await expect.poll(() => otherReloads).toBe(1);
    await expect(
      other
        .locator(".header")
        .getByRole("link", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(
      other.getByText("An update was applied in another tab."),
    ).toHaveCount(0);
    await expect(other.getByText("An app update is ready.")).toHaveCount(0);
    expect(
      await other.evaluate(() => localStorage.getItem("pd-update-check")),
    ).toBe("preserved");
    expect(
      await other.evaluate(() => Reflect.get(window, "unsavedPractice")),
    ).toBeUndefined();
  } finally {
    await other.close();
    await server.close();
  }
});
