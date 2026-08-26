/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    // Lets SCSS modules resolve root-relative imports like `@use 'theme'`.
    // `loadPaths` is the modern Sass API name; `includePaths` is kept for any
    // tooling still on the legacy API.
    loadPaths: [import.meta.dirname],
    includePaths: [import.meta.dirname],
  },
}

export default nextConfig
