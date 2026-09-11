/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * No `images.remotePatterns` here on purpose: avatars render through
   * next/image with `unoptimized`, so the optimizer never fetches them and
   * remote patterns would have no effect.
   */
};

export default nextConfig;
