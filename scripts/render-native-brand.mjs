// Export the approved SVG identity into opaque iOS catalog assets. No network or deployment.
import { chromium } from "playwright";
import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import process from "node:process";
import console from "node:console";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  const icon = readFileSync(resolve(root, "public/icons/source.svg"), "utf8");
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(
    `<body style="margin:0;background:#181818">${icon.replace("<svg ", '<svg width="1024" height="1024" ')}</body>`,
  );
  await page.screenshot({
    path: resolve(
      root,
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    ),
  });
  const mark = readFileSync(
    resolve(root, "public/brand/repformed-mark.svg"),
    "utf8",
  );
  await page.setViewportSize({ width: 2732, height: 2732 });
  await page.setContent(
    `<body style="margin:0;background:#181818;display:grid;place-items:center;width:2732px;height:2732px">${mark.replace("<svg ", '<svg width="560" height="370" ')}</body>`,
  );
  const splash = resolve(
    root,
    "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  );
  await page.screenshot({ path: splash });
  for (const suffix of ["-1", "-2"])
    copyFileSync(
      splash,
      resolve(
        root,
        `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${suffix}.png`,
      ),
    );
  console.log(
    "Exported Repformed iOS icon (1024px) and three splash assets (2732px).",
  );
} finally {
  await browser.close();
}
