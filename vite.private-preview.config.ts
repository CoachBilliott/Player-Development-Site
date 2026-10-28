import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "preview/private",
  base: "./",
  publicDir: "public",
  plugins: [react()],
  build: { outDir: "../../dist-private-preview", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5199 },
});
