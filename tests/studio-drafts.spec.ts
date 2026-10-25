import { test, expect } from "@playwright/test";
import { disableBackend } from "./backendFixture";
import { mockProject, sharedSignIn, type Row } from "./contentFixture";

const original = {
  name: "original-adult-practice.txt",
  mimeType: "text/plain",
  buffer: Buffer.from("Original fictional adult practice reference."),
};
async function fill(page: import("@playwright/test").Page) {
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles(original);
  await page.getByLabel("Resource title").fill("Fictional controlled steps");
  await page
    .getByLabel("What this drill trains")
    .fill("Practice reading the next marked space.");
  await page
    .getByLabel("Equipment and practice space")
    .fill("Two paper markers and a clear space");
  await page
    .getByLabel("Step-by-step instructions")
    .fill("Place the markers.\nWalk to the next marker.");
  await page.getByLabel("Main coaching cue").fill("Look at the next marker.");
}
test.beforeEach(async ({ context }) => {
  await disableBackend(context);
});

test("a saved staff draft restores the original file and coaching details after refresh, then publishes once", async ({
  page,
  context,
}) => {
  const rows = new Map<string, Row>();
  await mockProject(context, rows);
  await sharedSignIn(page);
  await fill(page);
  const viewport = page.viewportSize();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  if (viewport) await page.setViewportSize(viewport);
  await page.getByLabel("What this drill trains").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/coach-details-${page.viewportSize()?.width}.png`,
  });
  await page
    .getByRole("button", { name: "Save draft on this device" })
    .dblclick();
  await expect(
    page.getByText("Draft saved on this device. Nothing has been published.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(rows.size).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "Continue saved draft" }).click();
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "Fictional controlled steps",
  );
  await expect(page.getByLabel("What this drill trains")).toHaveValue(
    "Practice reading the next marked space.",
  );
  await expect(page.getByLabel("Equipment and practice space")).toHaveValue(
    "Two paper markers and a clear space",
  );
  await expect(page.getByLabel("Main coaching cue")).toHaveValue(
    "Look at the next marker.",
  );
  await expect(page.getByLabel("I have the rights")).not.toBeChecked();
  await expect(page.getByText(original.name, { exact: true })).toBeVisible();
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await expect(
    page.getByText("Practice reading the next marked space.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Look at the next marker.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Publish to shared library" })
    .dblclick();
  await expect(
    page.getByText("Saved to the protected training library.", { exact: true }),
  ).toBeVisible();
  expect(rows.size).toBe(1);
  expect([...rows.values()][0].content).toMatchObject({
    equipment: "Two paper markers and a clear space",
    lesson: "Practice reading the next marked space.",
    cue: "Look at the next marker.",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Coach content studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue saved draft" }),
  ).toHaveCount(0);
});

test("incomplete drafts can be saved, removal can be canceled, and sign-out clears device drafts", async ({
  page,
  context,
}) => {
  await mockProject(context, new Map());
  await sharedSignIn(page);
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles(original);
  await page.getByRole("button", { name: "Save draft on this device" }).click();
  await expect(
    page.getByText("Draft saved on this device. Nothing has been published.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Remove saved draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep saved draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue saved draft" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue saved draft" }).click();
  await expect(page.getByLabel("Step-by-step instructions")).toHaveValue("");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Coach sign-in" }),
  ).toBeVisible();
  await sharedSignIn(page);
  await expect(
    page.getByRole("heading", { name: "Coach content studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue saved draft" }),
  ).toHaveCount(0);
});

test("device storage failures retain the open form and retry can save without publishing", async ({
  page,
  context,
}) => {
  const rows = new Map<string, Row>();
  await mockProject(context, rows);
  await sharedSignIn(page);
  await fill(page);
  await page.evaluate(() => {
    const saved = IDBFactory.prototype.open;
    Reflect.set(window, "restoreDraftStorage", () => {
      IDBFactory.prototype.open = saved;
    });
    IDBFactory.prototype.open = function (
      ...args: Parameters<IDBFactory["open"]>
    ) {
      if (args[0] === "pd-staff-drafts")
        throw new DOMException("Storage denied", "QuotaExceededError");
      return saved.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Save draft on this device" }).click();
  await expect(
    page.getByRole("region", { name: "Device draft" }).getByRole("alert"),
  ).toBeVisible();
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "Fictional controlled steps",
  );
  await expect(
    page.getByText("Draft saved on this device. Nothing has been published.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, "restoreDraftStorage")());
  await page.getByRole("button", { name: "Save draft on this device" }).click();
  await expect(
    page.getByText("Draft saved on this device. Nothing has been published.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(rows.size).toBe(0);
});

test("a different saved draft requires confirmation before replacement", async ({
  page,
  context,
}) => {
  await mockProject(context, new Map());
  await sharedSignIn(page);
  await fill(page);
  await page.getByRole("button", { name: "Save draft on this device" }).click();
  await expect(
    page.getByText("Draft saved on this device. Nothing has been published.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({ ...original, name: "second-reference.txt" });
  await page.getByRole("button", { name: "Save draft on this device" }).click();
  await page.getByRole("button", { name: "Keep existing saved draft" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Continue saved draft" }).click();
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "Fictional controlled steps",
  );
  await page.getByLabel("Resource title").fill("Changed after saving");
  await expect(
    page.getByRole("region", { name: "Device draft" }),
  ).toContainText("New changes are not saved yet.");
});

test("editing retains existing purpose, equipment, cue and drill kind", async ({
  page,
  context,
}) => {
  const rows = new Map<string, Row>();
  await mockProject(context, rows);
  await sharedSignIn(page);
  await fill(page);
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await page.getByRole("button", { name: "Publish to shared library" }).click();
  await expect(
    page.getByText("Saved to the protected training library.", { exact: true }),
  ).toBeVisible();
  [...rows.values()][0].content.kind = "read";
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Fictional controlled steps" })
    .click();
  await expect(page.getByLabel("Equipment and practice space")).toHaveValue(
    "Two paper markers and a clear space",
  );
  await page.getByLabel("Resource title").fill("Updated title only");
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await page.getByRole("button", { name: "Save resource changes" }).click();
  await expect(
    page.getByText("Resource changes saved.", { exact: true }),
  ).toBeVisible();
  expect([...rows.values()][0].content).toMatchObject({
    kind: "read",
    lesson: "Practice reading the next marked space.",
    cue: "Look at the next marker.",
    equipment: "Two paper markers and a clear space",
  });
});

test("saved draft metadata is account-scoped and contains neither rights consent nor signed media URLs", async ({
  page,
  context,
}) => {
  await mockProject(context, new Map());
  await sharedSignIn(page);
  await fill(page);
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Save draft on this device" }).click();
  await expect(
    page.getByText("Draft saved on this device. Nothing has been published.", {
      exact: true,
    }),
  ).toBeVisible();
  const snapshot = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("pd-staff-drafts", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const records = await new Promise<Record<string, unknown>[]>((resolve) => {
      const r = db.transaction("drafts").objectStore("drafts").getAll();
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return records.map((row) => ({
      keys: Object.keys(row),
      drillKeys: Object.keys(row.drill as object),
      owner: row.owner,
      fileSize: (row.blob as Blob).size,
    }));
  });
  expect(snapshot).toHaveLength(1);
  expect(snapshot[0].owner).toBe("10000000-0000-4000-8000-000000000001");
  expect(snapshot[0].fileSize).toBe(original.buffer.length);
  expect(snapshot[0].keys).not.toContain("permission");
  expect(snapshot[0].drillKeys).not.toContain("assetUrl");
  const secondId = "10000000-0000-4000-8000-000000000002";
  await mockProject(context, new Map(), true, false, secondId);
  // Simulate an already-established different identity at the next app launch.
  await page.evaluate((id) => {
    const key = "sb-separate-demo-auth-token";
    const session = JSON.parse(localStorage.getItem(key)!);
    session.user.id = id;
    const parts = session.access_token.split(".");
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    payload.sub = id;
    parts[1] = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    session.access_token = parts.join(".");
    localStorage.setItem(key, JSON.stringify(session));
  }, secondId);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Coach content studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue saved draft" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Fictional controlled steps", { exact: true }),
  ).toHaveCount(0);
});
