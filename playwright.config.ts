import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3000)
// 127.0.0.1 rather than localhost: in containers, localhost can resolve to ::1
// first and stall while the dev server is listening on IPv4 only.
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Next compiles a route on first request in dev, so the first navigation in
  // a run is much slower than the rest.
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        // CI images and this dev container run as root, where the Chromium
        // sandbox refuses to start. /dev/shm is small in containers too.
        '--no-sandbox',
        '--disable-dev-shm-usage',
        /**
         * The browser resolves nothing but the dev server.
         *
         * `webServer.env` below stops the *server* calling a third party. This
         * is the other half, and it became load-bearing when reaction tiles
         * started reaching for their animation on Google's CDN: without it a
         * full run quietly fetches a few hundred 369KB files, and every spec
         * would pass whether or not the committed stills actually work.
         *
         * Blocking everything rather than that one host, so the suite's claim
         * is enforced by the network layer rather than by remembering to add
         * the next hostname here.
         */
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      ],
    },
  },

  // Mobile is listed first deliberately: it is the primary lens, and it is the
  // project that runs for `npm run test:e2e:mobile`.
  //
  // Chromium only — the browser cache ships Chromium alone, so no WebKit or
  // Firefox projects. "Mobile" here is Chromium emulating a phone.
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    /**
     * The suite talks to no third party, deliberately and explicitly.
     *
     * It was already true — but only because this machine happened to have no
     * keys, which meant anyone adding one to `.env.local` silently moved the
     * whole suite onto a live service. Both switches are stated here rather
     * than inherited from an absence:
     *
     * - `ABLY_STUB` keeps every room on the tab transport.
     * - `GIFS_STUB` keeps the picker *and the landing wall* on the offline
     *   shelf. Not every room spec passes `?gifs=stub`, and `room.spec.ts`
     *   walks a full game through the picker — so without this, a key turns a
     *   full-suite run into a few hundred live Giphy calls and breaks
     *   `landing.spec.ts`, which asserts the wall's stub art in the SSR HTML.
     */
    env: { ABLY_STUB: '1', GIFS_STUB: '1' },
  },
})
