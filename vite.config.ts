import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist/client",
    emptyOutDir: false
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000"
    }
  }
});
