import config from "@starter/eslint-config";

export default [
  {
    ignores: ["functions/**/vendor/", "**/dist/", "**/.sanity/", "**/sanity.types.ts", "**/.next/"],
  },
  ...config,
];
