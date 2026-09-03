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
     * - `NEXT_PUBLIC_GIFS_STUB` keeps the picker *and the landing wall* on the
     *   offline shelf. Not every room spec passes `?gifs=stub`, and
     *   `room.spec.ts` walks a full game through the picker — so without this,
     *   a key turns a full-suite run into a few hundred live Giphy calls and
     *   breaks `landing.spec.ts`, which asserts the wall's stub art in the SSR
     *   HTML.
     *
     *   `NEXT_PUBLIC_`, because the picker calls Giphy from the browser now —
     *   proxying it was against their terms, so there is no server left to
     *   read a server-only switch. The old name would be read by nothing and
     *   fail open, which is the worst way for this to break.
     */
    env: {
      ABLY_STUB: '1',
      NEXT_PUBLIC_GIFS_STUB: '1',
      /**
       * A key that is not a key.
       *
       * `?gifs=live` opts one page load back onto the real Giphy path so
       * `e2e/gifs.spec.ts` can intercept it and count calls — and without
       * *some* key set, that path falls through to the offline shelf and the
       * counting tests would assert nothing while looking like they passed.
       *
       * Nothing reaches Giphy with it: those specs fulfil the route
       * themselves, and `--host-resolver-rules` above resolves every host but
       * the dev server to nothing, so an uncaught call fails rather than
       * leaking.
       */
      NEXT_PUBLIC_GIPHY_API_KEY: 'e2e-not-a-real-key',
      // Both keys, for the same reason the Giphy one is here: a live path with
      // no key falls through to the offline shelf, so a call-counting test
      // would assert nothing at all while looking green.
      NEXT_PUBLIC_KLIPY_API_KEY: 'e2e-not-a-real-key',
      /**
       * Bots play with written-in jokes, so no spec spends a token.
       *
       * The suite would land here anyway — `--host-resolver-rules` resolves
       * every host but the dev server to nothing — but "anyway" is not a
       * guarantee: the model is reached through *our own* route, which is on
       * the dev server and therefore reachable. This is the thing that stops
       * a full run from being a bill.
       */
      NEXT_PUBLIC_BOTS_STUB: '1',
      /**
       * And a key that is not a key, for the reason the GIF ones are here:
       * `?brain=live` opts `e2e/bots.spec.ts` onto the route so it can
       * intercept and *count* calls, and with no key at all the route reports
       * `stub` and the counting would assert nothing while looking green.
       */
      ANTHROPIC_API_KEY: 'e2e-not-a-real-key',
    },
  },
})
