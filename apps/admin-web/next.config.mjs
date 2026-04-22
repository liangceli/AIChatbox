/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@platform/ai-core",
    "@platform/config",
    "@platform/logging",
    "@platform/tenant-core",
    "@platform/types",
    "@platform/utils"
  ]
};

export default nextConfig;
