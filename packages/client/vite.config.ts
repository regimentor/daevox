import { fileURLToPath, URL } from "node:url";
import { defineConfig, type UserConfig } from "vite";

export default defineConfig(({ mode }): UserConfig => {
  if (mode === "preload") {
    return {
      resolve: {
        alias: {
          "@daevox/contracts": fileURLToPath(
            new URL("../contracts/src/index.ts", import.meta.url),
          ),
        },
      },
      build: {
        emptyOutDir: false,
        lib: {
          entry: fileURLToPath(new URL("./src/preload.ts", import.meta.url)),
          formats: ["cjs"],
          fileName: () => "preload.cjs",
        },
        outDir: "dist",
        rollupOptions: {
          external: ["electron"],
        },
      },
    };
  }

  return {
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
  };
});
