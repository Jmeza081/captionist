import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

/**
 * The component gallery is a dev tool, so it is not in the production build.
 *
 * `pageExtensions` decides which files Next will even *look* at as routes.
 * Adding `dev.tsx` only under `PHASE_DEVELOPMENT_SERVER` means
 * `app/components/page.dev.tsx` is a route under `next dev` and an unreferenced
 * module under `next build` — the route does not exist, and nothing it imports
 * is in the bundle. A `notFound()` guard inside the page would have shipped the
 * whole gallery to serve a 404 with it.
 *
 * The phase argument rather than `process.env.NODE_ENV`: it is the signal Next
 * documents for this, and it says *which command is running* rather than what
 * the environment happens to be called.
 */
const DEV_PAGE_EXTENSIONS = ['dev.tsx', 'dev.ts']
const PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']

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

/** @type {(phase: string) => import('next').NextConfig} */
export default function config(phase) {
  return {
    ...nextConfig,
    pageExtensions:
      phase === PHASE_DEVELOPMENT_SERVER
        ? [...DEV_PAGE_EXTENSIONS, ...PAGE_EXTENSIONS]
        : PAGE_EXTENSIONS,
  }
}
