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
      // CI images and this dev container run as root, where the Chromium
      // sandbox refuses to start. /dev/shm is small in containers too.
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
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
  },
})
