import { disableBackend } from "./backendFixture";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openLocalStudio } from "./contentFixture";
async function onboard(page: Page, name = "Jordan") {
  await page.goto("./#onboarding");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  if (name !== "Morgan")
    await page.getByLabel("I’m exploring as a parent or guardian").check();
  await page.getByRole("button", { name: "See my training" }).click();
  await expect(
    page.getByRole("heading", { name: "Today’s training", level: 1 }),
  ).toBeVisible();
}
async function start(page: Page) {
  await page.getByRole("button", { name: "Start today’s session" }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Begin guided session" }).click();
  await expect(
    page.getByRole("button", { name: "Show practice steps" }),
  ).toBeVisible();
}
async function finish(page: Page) {
  for (;;) {
    await expect(
      page.getByRole("button", { name: "Show practice steps" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show practice steps" }).click();
    await page
      .getByRole("checkbox", { name: /completed the practice steps/ })
      .check();
    const finish = page.getByRole("button", { name: "Finish & reflect" });
    if (await finish.isVisible()) {
      await page.getByRole("button", { name: "Finish & reflect" }).click();
      break;
    }
    await page.getByRole("button", { name: "Next drill", exact: true }).click();
  }
  await page
    .getByRole("checkbox", { name: /confirm the sample practice/ })
    .check();
  await page
    .getByRole("button", { name: "Record completed practice" })
    .dblclick();
}
test.beforeEach(async ({ context }) => {
  await disableBackend(context);
});

test("homepage is responsive and sample demo is obvious", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /Your game/i, level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".hero .button")).toBeInViewport();
  await expect(page.locator(".hero .sport-tag")).toHaveText(
    "FOOTBALL · IN DEVELOPMENT",
  );
  await expect(page.locator(".hero .stadium-surface")).toHaveCount(0);
  const football = page.getByRole("article", {
    name: "American football program",
  });
  await expect(
    football.getByText("DEMO AVAILABLE", { exact: true }),
  ).toBeVisible();
  await expect(
    football.getByRole("link", { name: "Try the football demo", exact: true }),
  ).toHaveAttribute("href", "#demo");
  const upcoming = page.getByRole("article", {
    name: "Future sports",
    exact: true,
  });
  await expect(
    upcoming.getByText("COMING LATER", { exact: true }),
  ).toBeVisible();
  await expect(
    upcoming.getByRole("heading", { name: "More sports ahead." }),
  ).toBeVisible();
  await expect(upcoming.getByRole("link")).toHaveCount(0);
  await expect(upcoming.getByRole("button")).toHaveCount(0);
  await expect(page.getByText(/\bbasketball\b|\bsoccer\b/i)).toHaveCount(0);
  await page.getByRole("button", { name: "See how it works" }).click();
  await expect(
    page.getByRole("heading", { name: "A clear plan. Purposeful practice." }),
  ).toBeInViewport();
  const images = page.locator(".path-card > img, .football-program-image");
  await expect(images).toHaveCount(3);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
  const photoSources = await images.evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).currentSrc),
  );
  expect(new Set(photoSources).size).toBe(3);
  expect(
    photoSources.every((src) => !/training-poster|practice-detail/.test(src)),
  ).toBe(true);
  for (const link of await page.locator('.home a[href="#demo"]').all())
    await expect(link).toHaveAttribute("href", "#demo");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Try the demo", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => innerWidth),
  );
  await page.screenshot({
    path: `artifacts/home-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("parent onboarding, cancellation, and profile persistence", async ({
  page,
}) => {
  await page.goto("./#onboarding");
  await page.getByRole("button", { name: /Avery/ }).click();
  await page.getByRole("button", { name: "See my training" }).click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/home/);
  await onboard(page, "Avery");
  await expect(page.getByText("6 minutes", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Parent-managed preferences. Adult-supervised practice."),
  ).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Avery FICTIONAL/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Short activities. Parent alongside."),
  ).toBeVisible();
});
test("all selections build a usable adult profile", async ({ page }) => {
  await page.goto("./#onboarding");
  await page
    .getByRole("combobox", { name: "Age group", exact: true })
    .selectOption("18+");
  await page
    .getByRole("combobox", { name: "Football position", exact: true })
    .selectOption("Offensive line");
  await page
    .getByRole("combobox", { name: "Experience", exact: true })
    .selectOption("Experienced");
  await page
    .getByRole("combobox", { name: "Main goal", exact: true })
    .selectOption("Footwork");
  await page.getByRole("button", { name: "See my training" }).click();
  await expect(page.getByText("Adult player · Change profile")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Find your footing." }),
  ).toBeVisible();
  await start(page);
  await expect(
    page.getByRole("heading", { name: "Ready. Step. Reset." }),
  ).toBeVisible();
});
test("guided practice survives refresh, requires practice, records once, and isolates profiles", async ({
  page,
}, info) => {
  await onboard(page);
  await page.screenshot({
    path: `artifacts/today-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start today’s session" }).click();
  await expect(
    page.getByRole("button", { name: "Begin guided session" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await start(page);
  await page.getByRole("button", { name: "Show practice steps" }).click();
  await expect(
    page.getByRole("button", { name: "Next drill", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `artifacts/session-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pause for a break" }).click();
  await expect(
    page.getByText("Practice paused.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue practice" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Take it one step at a time." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review lesson" }).click();
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "Your practice history" }),
  ).toBeVisible();
  await expect(page.locator(".history-list article")).toHaveCount(1);
  await page.screenshot({
    path: `artifacts/progress-${info.project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".history-list article")).toHaveCount(1);
  await onboard(page, "Morgan");
  await page.goto("./#progress");
  await expect(
    page.getByRole("heading", { name: "Your first small step is ahead." }),
  ).toBeVisible();
});
test("end session and reset canceled actions preserve state", async ({
  page,
}) => {
  await onboard(page);
  await start(page);
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await page.getByRole("button", { name: "Keep practicing" }).click();
  await expect(
    page.getByRole("button", { name: "Show practice steps" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await page.getByRole("button", { name: "End without recording" }).click();
  await expect(
    page.getByRole("button", { name: "Start today’s session" }),
  ).toBeVisible();
  await start(page);
  await finish(page);
  await page.getByRole("button", { name: "Reset demo history" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".history-list article")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset demo history" }).click();
  await page.getByRole("button", { name: "Reset this history" }).click();
  await expect(
    page.getByRole("heading", { name: "Your first small step is ahead." }),
  ).toBeVisible();
});
test("library combines filters, clears empty results, and previews age restrictions", async ({
  page,
}) => {
  await onboard(page, "Avery");
  await page.goto("./#library");
  await page
    .getByRole("combobox", { name: "Age group", exact: true })
    .selectOption("13–17");
  await page
    .getByRole("combobox", { name: "Position", exact: true })
    .selectOption("Quarterback");
  await page
    .getByRole("combobox", { name: "Experience", exact: true })
    .selectOption("Building fundamentals");
  await page
    .getByRole("combobox", { name: "Skill", exact: true })
    .selectOption("Footwork");
  await page.getByRole("searchbox").fill("quarterback");
  await expect(page.locator(".drill-card")).toHaveCount(1);
  await page.getByRole("button", { name: /Quarterback reset/ }).click();
  await expect(
    page.getByText("does not match Avery", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Practice this drill" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("searchbox").fill("not-a-drill");
  await expect(
    page.getByRole("heading", { name: "No drills match just yet." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(page.locator(".drill-card")).toHaveCount(10);
});
async function fillResource(page: Page) {
  await openLocalStudio(page);
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "original-demo.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Original illustrative paper exercise. No real player information.",
      ),
    });
  await page.getByLabel("Resource title").fill("Our original paper practice");
  await page
    .getByLabel("Step-by-step instructions")
    .fill(
      "Draw two shapes on paper.\nPoint to a shape with a parent.\nSwap roles and pause.",
    );
}
test("phone upload reveals details, keeps a valid file after a canceled or rejected replacement, and previews the chosen audience", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 760 });
  await openLocalStudio(page);
  await expect(page.getByLabel("Resource title")).toHaveCount(0);
  await page.getByText("How uploads work", { exact: true }).click();
  await expect(page.getByText(/Maximum 40 MB per file/)).toBeVisible();
  const picker = page.getByLabel("Choose a video or file", { exact: true });
  await picker.setInputFiles({
    name: "original_ball-skills.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Original illustrative practice instructions."),
  });
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "original ball skills",
  );
  await page.getByLabel("Resource title").fill("Our reviewed sample practice");
  await picker.setInputFiles([]);
  await expect(
    page.getByText("original_ball-skills.txt", { exact: true }),
  ).toBeVisible();
  await picker.setInputFiles({
    name: "unsupported.html",
    mimeType: "text/html",
    buffer: Buffer.from("Unsupported fictional media fixture"),
  });
  await expect(
    page.getByText("original_ball-skills.txt", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "Our reviewed sample practice",
  );
  await page
    .getByRole("button", { name: "Jordan · 8–12", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Position", exact: true }),
  ).toHaveValue("Wide receiver");
  await page
    .getByLabel("Step-by-step instructions")
    .fill(
      "Place a soft ball on the ground.\nPoint to the ball with an adult.\nPause together.",
    );
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await expect(page.locator(".match-list").getByText("Jordan")).toBeVisible();
  await expect(
    page.getByText("Destination: this browser only · practice upload"),
  ).toBeVisible();
  const checks = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(checks.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Back to editing" }).click();
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "Our reviewed sample practice",
  );
  await page.getByText("How uploads work", { exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/easy-upload-${info.project.name}.png`,
    fullPage: true,
  });
});
test("coach previews matches, cancels edits, publishes once, and persists attachment", async ({
  page,
}, info) => {
  await fillResource(page);
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "Our original paper practice",
  );
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await expect(
    page.getByText("No sample profile matches all four selections.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to editing" }).click();
  await page
    .getByRole("combobox", { name: "Primary goal / skill", exact: true })
    .selectOption("Ball skills");
  await page.getByRole("button", { name: "Preview matches" }).click();
  await expect(page.locator(".match-list").getByText("Jordan")).toBeVisible();
  await page.screenshot({
    path: `artifacts/coach-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Publish to demo library" })
    .dblclick();
  await expect(
    page.getByText("Published to your local demo library.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pd-demo-v1")!).custom.length,
    ),
  ).toBe(1);
  await page.goto("./#library");
  await page.getByRole("searchbox").fill("Our original paper");
  await page
    .getByRole("button", { name: /Our original paper practice/ })
    .click();
  await expect(
    page.getByRole("link", { name: /Download original-demo.txt/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("searchbox").fill("Our original paper");
  await page
    .getByRole("button", { name: /Our original paper practice/ })
    .click();
  await expect(
    page.getByRole("link", { name: /Download original-demo.txt/ }),
  ).toBeVisible();
});
test("invalid file, canceled file picker, discard and browser storage failure are handled", async ({
  page,
}) => {
  await fillResource(page);
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles([]);
  await expect(
    page.getByText("original-demo.txt", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "bad.html",
      mimeType: "text/html",
      buffer: Buffer.from("<script>test</script>"),
    });
  await expect(
    page.getByText(
      "Choose MP4, MOV, WebM, PNG, JPEG, WebP, PDF, or plain text.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "big.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(41 * 1024 * 1024),
    });
  await expect(
    page.getByText(
      "Choose a file no larger than 40 MB. Prepare or shorten a large video first.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Yes, discard draft" }).click();
  await expect(page.getByLabel("Resource title")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Start with your video or file" }),
  ).toBeVisible();
  await page.goto("./#onboarding");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("No storage", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: /Morgan/ }).click();
  await page.getByRole("button", { name: "See my training" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Browser storage could not be saved",
  );
});
test("corrupted data falls back safely and future memberships have no checkout", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(() =>
    localStorage.setItem("pd-demo-v1", '{"broken":true}'),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Saved demo data could not be read",
  );
  await page.goto("./#membership");
  await expect(page.getByText("Not available to purchase")).toHaveCount(4);
  await expect(page.getByText("PROPOSED PACKAGE", { exact: true })).toHaveCount(
    4,
  );
  await expect(
    page.getByRole("button", { name: /buy|pay|checkout/i }),
  ).toHaveCount(0);
});
test("all screens fit mobile and navigation is keyboard accessible", async ({
  page,
}, info) => {
  await onboard(page, "Morgan");
  for (const route of [
    "home",
    "today",
    "library",
    "progress",
    "coach",
    "membership",
    "onboarding",
  ]) {
    await page.goto("./#" + route);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const inputs = page.locator(
      "input:not([type=checkbox]):not([type=file]), select",
    );
    for (let i = 0; i < (await inputs.count()); i++) {
      const box = await inputs.nth(i).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
  if (info.project.name === "phone") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Log in", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Private profiles are being connected.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeVisible();
  }
});

test("failed publishing keeps the draft and does not create a library entry", async ({
  page,
}) => {
  await fillResource(page);
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await page.evaluate(() => {
    Reflect.set(window, "savedSetItem", Storage.prototype.setItem);
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Publish to demo library" }).click();
  await expect(page.getByRole("alert")).toContainText("Publishing failed");
  await expect(
    page.getByRole("heading", { name: "Our original paper practice" }),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = Reflect.get(window, "savedSetItem");
  });
  await page.getByRole("button", { name: "Publish to demo library" }).click();
  await expect(
    page.getByText("Published to your local demo library.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pd-demo-v1")!).custom.length,
    ),
  ).toBe(1);
});

test("original uploaded video plays and remains available after refresh", async ({
  page,
}) => {
  await fillResource(page);
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#153f35";
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = "#d9ed9c";
    ctx.font = "18px sans-serif";
    ctx.fillText("Original test fixture", 30, 80);
    ctx.font = "12px sans-serif";
    ctx.fillText("Not a coaching demonstration", 30, 110);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    const result = new Promise<number[]>((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () =>
        resolve(
          Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())),
        );
    });
    recorder.start();
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#d9ed9c" : "#ec9666";
      ctx.fillRect(30, 135, 20 + i * 10, 8);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    return result;
  });
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "original-test.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(bytes),
    });
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await video.evaluate(async (node: HTMLVideoElement) => {
    node.muted = true;
    node.loop = true;
    await node.play();
  });
  expect(
    await video.evaluate((node: HTMLVideoElement) => node.readyState),
  ).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Publish to demo library" }).click();
  await page.goto("./#library");
  await page.getByRole("searchbox").fill("Our original paper");
  await page
    .getByRole("button", { name: /Our original paper practice/ })
    .click();
  await expect(page.locator("video")).toBeVisible();
  await page.reload();
  await page.getByRole("searchbox").fill("Our original paper");
  await page
    .getByRole("button", { name: /Our original paper practice/ })
    .click();
  await expect(page.locator("video")).toBeVisible();
});

test("small phones and tablets have no horizontal overflow", async ({
  page,
}) => {
  await onboard(page, "Morgan");
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "home",
      "onboarding",
      "today",
      "library",
      "coach",
      "progress",
      "membership",
      "install",
    ]) {
      await page.goto("./#" + route);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${route} at ${width}px`,
      ).toBeLessThanOrEqual(width);
    }
  }
});

test("uploaded resource edits preserve its file, support cancellation, and persist", async ({
  page,
}) => {
  await fillResource(page);
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await page.getByRole("button", { name: "Publish to demo library" }).click();
  await page
    .getByRole("button", {
      name: "Edit Our original paper practice",
      exact: true,
    })
    .click();
  await page.getByLabel("Resource title").fill("Unsaved title");
  await page.getByRole("button", { name: "Cancel edits" }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Resource title")).toHaveValue("Unsaved title");
  await page.getByRole("button", { name: "Cancel edits" }).click();
  await page.getByRole("button", { name: "Yes, discard draft" }).click();
  await page
    .getByRole("button", {
      name: "Edit Our original paper practice",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "Our original paper practice",
  );
  await page
    .getByLabel("Resource title")
    .fill("Updated original paper practice");
  await page
    .getByLabel("Step-by-step instructions")
    .fill("Draw one shape.\nPoint to it with an adult.\nPause.");
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await expect(
    page.getByRole("link", { name: "Download original-demo.txt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save resource changes" }).dblclick();
  await expect(
    page.getByText("Resource changes saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "This browser", exact: true }).click();
  await page
    .getByRole("button", { name: "Switch destination", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Updated original paper practice" })
    .click();
  await expect(page.getByLabel("Step-by-step instructions")).toHaveValue(
    "Draw one shape.\nPoint to it with an adult.\nPause.",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pd-demo-v1")!).custom.length,
    ),
  ).toBe(1);
});

test("replacement-file failure preserves the published attachment and removal requires confirmation", async ({
  page,
}) => {
  await fillResource(page);
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await page.getByRole("button", { name: "Publish to demo library" }).click();
  await expect(
    page.getByText("Published to your local demo library.", { exact: true }),
  ).toBeVisible();
  const originalId = await page.evaluate(
    () => JSON.parse(localStorage.getItem("pd-demo-v1")!).custom[0].assetId,
  );
  await page
    .getByRole("button", { name: "Edit Our original paper practice" })
    .click();
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "replacement.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Original replacement sample, no real player information.",
      ),
    });
  await page.getByLabel("I have the rights").check();
  await page.getByRole("button", { name: "Preview matches" }).click();
  await page.evaluate(() => {
    Reflect.set(window, "savedSetItem", Storage.prototype.setItem);
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save resource changes" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "published resource is unchanged",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pd-demo-v1")!).custom[0].assetId,
    ),
  ).toBe(originalId);
  await page.evaluate(() => {
    Storage.prototype.setItem = Reflect.get(window, "savedSetItem");
  });
  await page.getByRole("button", { name: "Save resource changes" }).click();
  await expect(
    page.getByText("Resource changes saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Our original paper practice" })
    .click();
  await page.getByRole("button", { name: "Keep resource" }).click();
  await expect(
    page.getByRole("button", { name: "Edit Our original paper practice" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Our original paper practice" })
    .click();
  await expect(
    page.getByText("Current file: replacement.txt", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Our original paper practice" })
    .click();
  await page.getByRole("button", { name: "Yes, remove resource" }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pd-demo-v1")!).custom.length,
    ),
  ).toBe(0);
});

test("staff publishing destinations can be switched or canceled without publishing a draft", async ({
  page,
}) => {
  await fillResource(page);
  await page
    .getByRole("button", { name: "Shared website", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Resource title")).toHaveValue(
    "Our original paper practice",
  );
  await page
    .getByRole("button", { name: "Shared website", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Switch destination", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Shared website", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Resource title")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Publish to/ })).toHaveCount(0);
});
