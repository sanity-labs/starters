import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import studio from "@sanity/eslint-config-studio";

export default defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "**/dist/", "**/.sanity/"]),
  { files: ["app/**/*.{js,mjs,ts,tsx}"], extends: [...nextVitals, ...nextTs] },
  { files: ["studio/**/*.{js,mjs,ts,tsx}"], extends: [...studio] },
]);
