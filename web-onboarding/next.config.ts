import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env["NEXT_PUBLIC_API_URL"] ?? "https://api.tigerclaw.io",
  },
  async redirects() {
    return [
      // /signup is gone — it's merged into the single long-scroll landing.
      // Query strings (?email=...) are forwarded automatically.
      { source: "/signup", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
