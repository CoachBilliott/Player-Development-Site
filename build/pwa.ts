import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** Precache only this project's versioned app shell, never accounts or uploaded media. */
export function appShell(): Plugin {
  return {
    name: "player-development-app-shell",
    apply: "build",
    writeBundle(options, bundle) {
      const publicFiles = [
        "manifest.webmanifest",
        "favicon.svg",
        "media/training-poster.jpg",
        "media/practice-detail.jpg",
        "media/football-field.jpg",
        "media/credits.txt",
        "icons/app-192.png",
        "icons/app-512.png",
        "icons/maskable-512.png",
        "icons/apple-touch-180.png",
      ];
      const files = [
        ...Object.keys(bundle).filter((name) =>
          /\.(html|js|css|woff2?)$/.test(name),
        ),
        ...publicFiles,
      ];
      const template = readFileSync("build/service-worker.txt", "utf8");
      const hash = createHash("sha256").update(template);
      for (const name of files) {
        const asset = bundle[name];
        hash
          .update(name)
          .update(
            asset
              ? asset.type === "chunk"
                ? asset.code
                : asset.source
              : readFileSync(`public/${name}`),
          );
      }
      writeFileSync(
        resolve(options.dir || "dist", "sw.js"),
        template
          .replace("__VERSION__", hash.digest("hex").slice(0, 16))
          .replace("__ASSETS__", JSON.stringify(files)),
      );
    },
  };
}
