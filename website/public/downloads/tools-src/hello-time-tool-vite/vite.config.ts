import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "HelloTimeTool",
      formats: ["es"],
      fileName: () => "hello-time-tool.mjs",
    },
    sourcemap: true,
  },
});
