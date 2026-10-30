import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "preview/meet-the-staff",
  base: "./",
  plugins: [react()],
  build: { outDir: "../../dist-meet-the-staff", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5177 },
});
