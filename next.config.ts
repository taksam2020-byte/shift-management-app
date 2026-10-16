import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare では画像の自動変換サービスを使わない（ロゴ画像をそのまま配信する）
  images: { unoptimized: true },
};

export default nextConfig;
