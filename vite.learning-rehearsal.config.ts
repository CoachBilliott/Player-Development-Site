import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const csp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src https://ojcfrfpeftvngyluomex.supabase.co; img-src 'self' data: blob: https://ojcfrfpeftvngyluomex.supabase.co; font-src 'self'; media-src blob: https://ojcfrfpeftvngyluomex.supabase.co; object-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'self'";
export default defineConfig({
  root: "preview/rehearsal",
  base: "./",
  publicDir: "public",
  plugins: [react()],
  build: {
    outDir: "../../dist-learning-rehearsal",
    emptyOutDir: true,
    sourcemap: false,
  },
  preview: {
    host: "127.0.0.1",
    port: 5201,
    strictPort: true,
    headers: {
      "Content-Security-Policy": csp,
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  },
});
