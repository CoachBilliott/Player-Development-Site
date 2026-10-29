import { mkdir, copyFile, cp, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
const root = resolve("preview/private/public");
await mkdir(resolve(root, "brand"), { recursive: true });
for (const path of [
  "brand/repformed-mark.svg",
  "account-help.html",
  "credits.html",
  "help.css",
  "interest-privacy.html",
  "social-links.css",
  "social-links.js",
  "social-links.json",
  "partner-guide.html",
  "partner-guide.pdf",
  "phone-test.html",
  "phone-test.pdf",
])
  await copyFile(resolve("public", path), resolve(root, path));
for (const path of ["help", "partner-guide"])
  await cp(resolve("public", path), resolve(root, path), { recursive: true });
await writeFile(
  resolve(root, "_headers"),
  `/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data: blob:; font-src 'self'; media-src 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'self'
`,
);
if (!process.argv.includes("--prepare-only")) {
  execFileSync(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--config",
      "vite.private-preview.config.ts",
    ],
    { stdio: "inherit" },
  );
  const html = await readFile("dist-private-preview/index.html", "utf8");
  if (!html.includes("noindex")) throw Error("Preview must not be indexed");
}
