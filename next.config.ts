import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR/dev resources when accessing via a Cloudflare tunnel on devices
  // Replace or add your current subdomain if it differs
  allowedDevOrigins: [
    "algebra-gravity-contained-autumn.trycloudflare.com",
    "senate-endless-reflection-wiki.trycloudflare.com",
  ],
};

export default nextConfig;
