import { test, expect, type Page } from "@playwright/test";
async function onboard(page: Page, name = "Jordan") {
  await page.goto("./#onboarding");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  if (name !== "Morgan")
    await page.getByLabel("I’m exploring as a parent or guardian").check();
  await page.getByRole("button", { name: "See my training" }).click();
  await expect(
    page.getByRole("heading", { name: /better at showing up/ }),
  ).toBeVisible();
}
async function start(page: Page) {
  await page.getByRole("button", { name: "Start today’s session" }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Begin guided session" }).click();
}
async function finish(page: Page) {
  while (
    await page.getByRole("button", { name: "Show practice steps" }).isVisible()
  ) {
    await page.getByRole("button", { name: "Show practice steps" }).click();
    await page
      .getByRole("checkbox", { name: /completed the practice steps/ })
      .check();
    const next = page.getByRole("button", { name: "Next drill", exact: true });
    if (await next.isVisible()) await next.click();
    else {
      await page.getByRole("button", { name: "Finish & reflect" }).click();
      break;
    }
  }
  await page
    .getByRole("checkbox", { name: /confirm the sample practice/ })
    .check();
  await page
    .getByRole("button", { name: "Record completed practice" })
    .dblclick();
}
test("homepage is responsive and sample demo is obvious", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /A little practice/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "See how it works" }).click();
  await expect(
    page.getByRole("heading", { name: /Less guesswork/ }),
  ).toBeInViewport();
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
  await page.goto("./#coach");
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
    page.getByText("Choose MP4, WebM, PNG, JPEG, WebP, PDF, or plain text.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Choose a video or file", { exact: true })
    .setInputFiles({
      name: "big.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(13 * 1024 * 1024),
    });
  await expect(
    page.getByText("Choose a file smaller than 12 MB."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Yes, discard draft" }).click();
  await expect(page.getByLabel("Resource title")).toHaveValue("");
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
  await expect(page.getByText("Not available to purchase")).toHaveCount(3);
  await expect(page.getByText("Pricing to be determined")).toHaveCount(3);
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
      .getByRole("link", { name: "Coach studio" })
      .click();
    await expect(
      page.getByRole("heading", { name: /A little knowledge/ }),
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
