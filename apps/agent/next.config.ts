import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@minicom/chat-core", "@minicom/chat-ui"],
};

export default nextConfig;
