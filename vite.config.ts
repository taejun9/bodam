import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

import { themeBootstrapContractPlugin } from "./build/theme-bootstrap-contract.js";

export default defineConfig(({ mode }) => ({
  plugins: [vue(), themeBootstrapContractPlugin()],
  define: {
    __BODAM_E2E__: JSON.stringify(mode === "e2e"),
  },
  build: {
    outDir: mode === "e2e" ? "dist-e2e" : "dist",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
}));
