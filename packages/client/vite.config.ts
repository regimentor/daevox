import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [tailwindcss()],
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
