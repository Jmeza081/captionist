/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Playwright drives the dev server over 127.0.0.1; without this, Next 16
  // blocks its own dev chunks as cross-origin and HMR never connects.
  allowedDevOrigins: ['127.0.0.1'],
  sassOptions: {
    // Lets SCSS modules resolve root-relative imports like `@use 'theme'`.
    // `loadPaths` is the modern Sass API name; `includePaths` is kept for any
    // tooling still on the legacy API.
    loadPaths: [import.meta.dirname],
    includePaths: [import.meta.dirname],
  },
}

export default nextConfig
