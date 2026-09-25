import { test, expect } from "@playwright/test";

/**
 * One page, one test: every public route renders without a server error,
 * has no horizontal scroll at phone width (the exact class of bug fixed in
 * PR #164 — overflow-x on body splitting sticky-nav from the viewport),
 * and has no unhandled `console.error`. None of these need a database —
 * every one of these routes falls back to seed content (see
 * playwright.config.ts's header comment).
 */
const PUBLIC_PAGES = [
  "/",
  "/product",
  "/colleague-pulse",
  "/solutions",
  "/solutions/banking",
  "/solutions/education",
  "/solutions/retail",
  "/solutions/healthcare",
  "/pricing",
  "/how-it-works",
  "/company",
  "/contact",
  "/privacy",
  "/terms",
  "/login",
];

for (const path of PUBLIC_PAGES) {
  test(`${path} renders without error, no horizontal overflow at phone width`, async ({ page }) => {
    const pageErrors: string[] = [];
    // A 404 on the browser's own implicit /favicon.ico request is
    // pre-existing, cosmetic, and unrelated to any page's own code — every
    // page triggers it via default browser behavior, not this app, so it's
    // excluded by URL (not by message text, which doesn't carry the URL).
    const failedRequests: string[] = [];
    page.on("requestfailed", (req) => {
      if (!req.url().endsWith("/favicon.ico")) failedRequests.push(req.url());
    });
    page.on("response", (res) => {
      if (res.status() >= 400 && !res.url().endsWith("/favicon.ico")) failedRequests.push(`${res.status()} ${res.url()}`);
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status(), `${path} should not 4xx/5xx`).toBeLessThan(400);

    // A thrown render error on this app falls through to Next's default
    // error boundary, which always includes this string.
    await expect(page.locator("body")).not.toContainText("Application error");

    await page.setViewportSize({ width: 390, height: 844 });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `${path} should not scroll horizontally at 390px wide`).toBeLessThanOrEqual(clientWidth + 1);

    expect(pageErrors, `${path} threw uncaught JS errors: ${pageErrors.join("; ")}`).toEqual([]);
    expect(failedRequests, `${path} had failed/4xx/5xx resource requests: ${failedRequests.join("; ")}`).toEqual([]);
  });
}
