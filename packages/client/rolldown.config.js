import { defineConfig } from "rolldown";

export default defineConfig({
  input: "dist/render.js",
  output: {
    file: "dist/render.bundle.js",
    format: "esm",
    sourcemap: true,
  },
});
