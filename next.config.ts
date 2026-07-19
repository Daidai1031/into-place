import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/ JSON is read via fs at request time; make sure Vercel bundles it.
  outputFileTracingIncludes: {
    "/**": ["data/**", "public/films/**"],
  },
  // Pixel preprocessing stays server-only and outside route bundles.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
