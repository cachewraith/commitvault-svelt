import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests. They expect the full stack to be running:
 *   docker compose up -d postgres && (cd ../backend && cargo run) && bun run dev
 * or `docker compose up` from the workspace root.
 *
 * Browsers are not installed by `bun install`; run `bunx playwright install chromium` once.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Set E2E_BROWSER_CHANNEL=chrome to use an installed Google Chrome
        // instead of the Playwright-managed Chromium download.
        channel: process.env.E2E_BROWSER_CHANNEL || undefined,
      },
    },
  ],
});
