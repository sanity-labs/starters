import { defineConfig } from "rolldown";

export default defineConfig({
  input: { index: "hello-world/index.ts" },
  output: {
    dir: "dist/hello-world",
    cleanDir: true,
    codeSplitting: false,
    minify: true,
    comments: false,
  },
  platform: "node",
});
