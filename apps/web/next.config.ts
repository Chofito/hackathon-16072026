import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@guateofertas/db", "@guateofertas/core"],
};

export default nextConfig;
