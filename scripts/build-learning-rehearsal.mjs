import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import process from "node:process";
const dir = "preview/rehearsal/public";
await mkdir(`${dir}/templates`, { recursive: true });
for (const file of [
  "weekly-learning-help.html",
  "templates/repformed-quiz-blank.csv",
  "templates/repformed-quiz-example.csv",
])
  await copyFile(`public/${file}`, `${dir}/${file}`);
await writeFile(
  `${dir}/_headers`,
  `/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Cache-Control: no-store
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src https://ojcfrfpeftvngyluomex.supabase.co; img-src 'self' data: blob: https://ojcfrfpeftvngyluomex.supabase.co; font-src 'self'; media-src blob: https://ojcfrfpeftvngyluomex.supabase.co; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'self'
`,
);
execFileSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "vite.learning-rehearsal.config.ts",
  ],
  { stdio: "inherit" },
);
const headers = await readFile("dist-learning-rehearsal/_headers", "utf8");
if (
  headers.includes("iilbulpqbuknhdpmtrvm") ||
  !headers.includes("connect-src https://ojcfrfpeftvngyluomex.supabase.co;")
)
  throw Error("Harness connection isolation failed");
