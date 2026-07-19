import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/ JSON is read via fs at request time; make sure Vercel bundles it.
  outputFileTracingIncludes: {
    "/**": ["data/**", "public/films/**"],
  },
  // Pipeline-only packages must never be bundled into routes.
  serverExternalPackages: ["puppeteer", "sharp"],
};

export default nextConfig;
