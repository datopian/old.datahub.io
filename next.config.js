/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export (PortalJS Arc and any static host serve out/ as-is). trailingSlash
  // makes every route a directory with index.html, which every static host resolves.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig
