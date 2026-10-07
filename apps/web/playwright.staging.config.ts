import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against the deployed STAGING site (no local server, no local database).
 * Never point STAGING_URL at production. Logins come from environment
 * variables, see e2e-staging/helpers.ts.
 *   STAGING_URL=https://oodelscore-staging.onrender.com npx playwright test -c apps/web/playwright.staging.config.ts
 */
export default defineConfig({
  testDir: "./e2e-staging",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: 4,
  retries: 1,
  reporter: [["list"], ["json", { outputFile: "e2e-staging/results.json" }]],
  use: {
    baseURL: process.env.STAGING_URL || "https://oodelscore-staging.onrender.com",
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
      },
    },
  ],
});
