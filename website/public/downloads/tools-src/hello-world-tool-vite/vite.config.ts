import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "HelloWorldTool",
      formats: ["es", "umd"],
      fileName: (format) =>
        format === "es" ? "hello-world-tool.mjs" : "hello-world-tool.umd.js",
    },
    sourcemap: true,
  },
});
