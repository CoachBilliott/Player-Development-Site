import { disableBackend } from "./backendFixture";
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

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
  const manifest = await (
    await page.request.get("./manifest.webmanifest")
  ).json();
  expect(manifest.scope).toBe("./");
  expect(manifest.display).toBe("standalone");
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
  expect(cached.some((url) => url.endsWith("/media/training-poster.jpg"))).toBe(
    true,
  );
  expect(cached.some((url) => url.endsWith("/media/practice-detail.jpg"))).toBe(
    true,
  );
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

test("a real waiting service-worker update waits for confirmation and preserves saved data", async ({
  page,
}) => {
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
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Test server did not start");
    await page.goto(`http://127.0.0.1:${address.port}/#install`);
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
    newer = true;
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
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
