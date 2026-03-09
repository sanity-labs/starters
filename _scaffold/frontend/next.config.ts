import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "cdn.sanity.io" }],
  },
};

export default config;
