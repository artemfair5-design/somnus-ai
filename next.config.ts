import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel автоматически определяет Next.js — output: "standalone" не нужен
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
