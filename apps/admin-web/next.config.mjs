/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.clerk.accounts.dev https://clerk.com; frame-src https://*.clerk.accounts.dev; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://*.clerk.accounts.dev" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" }
        ]
      }
    ];
  },
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
