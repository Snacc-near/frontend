/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // The wallet connector is imported on demand (src/chain/wallet.tsx); give its chunk a clear name.
        manualChunks: (id) => (id.includes("node_modules/@hot-labs/near-connect/") ? "near-connect" : undefined),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
