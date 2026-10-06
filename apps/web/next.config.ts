import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@oodelscore/shared"],
  async redirects() {
    return [
      { source: "/product", destination: "/customer-x", permanent: true },
      { source: "/colleague-pulse", destination: "/colleague-x", permanent: true },
    ];
  },
};

export default nextConfig;
