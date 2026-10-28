import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "preview/private",
  base: "./",
  publicDir: "public",
  plugins: [react()],
  build: { outDir: "../../dist-private-preview", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5199 },
  preview: {
    host: "127.0.0.1",
    port: 5199,
    headers: {
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data: blob:; font-src 'self'; media-src 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'self'",
    },
  },
});
