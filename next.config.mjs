/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Playwright drives the dev server over 127.0.0.1; without this, Next 16
  // blocks its own dev chunks as cross-origin and HMR never connects.
  //
  // A second device — the phone that scans the lobby's QR code — arrives on a
  // LAN address instead, and would be blocked the same way. That address is
  // per-machine and changes with the lease, so it comes from the environment
  // rather than living here: `LAN_HOST=192.168.1.23 npm run dev`. Nothing to
  // remember to remove before deploying, because `allowedDevOrigins` only
  // affects `next dev` and the default stays loopback-only.
  allowedDevOrigins: ['127.0.0.1', ...(process.env.LAN_HOST ? [process.env.LAN_HOST] : [])],
  sassOptions: {
    // Lets SCSS modules resolve root-relative imports like `@use 'theme'`.
    // `loadPaths` is the modern Sass API name; `includePaths` is kept for any
    // tooling still on the legacy API.
    loadPaths: [import.meta.dirname],
    includePaths: [import.meta.dirname],
  },
}

export default nextConfig
