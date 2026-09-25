import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-test layer only — pages that render without a database connection
 * (the marketing site + login), via getSiteContent's seed-fallback path
 * (see src/lib/siteContent.ts: any DB error/absence falls back to
 * SEED_SITE_CONTENT). Deliberately does NOT cover anything requiring auth,
 * a real session, or stored data (feedback submission, RBAC, billing
 * gates) — those need a real MongoDB instance, which this repo has no
 * self-contained way to provision in CI yet. This layer still catches a
 * real, common class of regression: a broken import, a thrown render
 * error, or a layout overflow on every public page a visitor or a search
 * crawler actually hits.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // This repo's sandbox pre-installs Chromium itself, not the
        // separate "headless shell" binary Playwright otherwise tries to
        // download on first run — point at it directly rather than
        // fetching anything. CI environments with a full Playwright
        // browser install ignore this override harmlessly if the path
        // doesn't exist there; set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 and
        // drop this line for a CI image that installs its own browsers.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
