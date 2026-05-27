import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(".");
    return config;
  },
};

export default nextConfig;
