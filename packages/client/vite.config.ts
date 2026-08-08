import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@daevox/ui": fileURLToPath(
        new URL("../ui/index.tsx", import.meta.url),
      ),
    },
  },
  css: {
    modules: {
      localsConvention: "camelCaseOnly",
    },
  },
  build: {
    outDir: "dist/renderer",
  },
});
