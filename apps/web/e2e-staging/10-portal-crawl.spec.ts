import { test, expect } from "@playwright/test";
import { ACCOUNTS, assertNotProduction, login, overflowPx, watchErrors } from "./helpers";

/**
 * For every demo account: open the portal, follow every menu link it shows,
 * and on each page check there is no server error, no script error, the page
 * is not blank, and (at phone width) nothing scrolls sideways.
 */
test.beforeAll(({}, info) => assertNotProduction(info.project.use.baseURL));

const SKIP = /\/(logout)|^\/api\//;

for (const acct of ACCOUNTS) {
  test(`crawl menu pages: ${acct.key}`, async ({ browser, baseURL }) => {
    test.setTimeout(600_000);
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
    const { status } = await login(context, acct);
    expect(status).toBe(200);
    const page = await context.newPage();
    const problems = watchErrors(page);
    await page.goto(`/${acct.portal}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const landing = new URL(page.url()).pathname;
    expect(landing.startsWith(`/${acct.portal}`), `landed on ${landing}`).toBeTruthy();

    const hrefs = await page.$$eval("a[href]", (as, portal) =>
      [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href") || "").filter((h) => h.startsWith(`/${portal}`) && !h.includes("#")))], acct.portal);
    const links = hrefs.filter((h) => !SKIP.test(h)).slice(0, 80);
    test.info().annotations.push({ type: "pages", description: String(links.length) });

    const bad: string[] = [];
    for (const href of links) {
      for (const vp of [{ width: 1280, height: 800, label: "desktop" }, { width: 390, height: 844, label: "phone" }]) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        problems.length = 0;
        const t0 = Date.now();
        const resp = await page.goto(href, { waitUntil: "domcontentloaded" }).catch((e) => ({ status: () => 0, err: String(e) }) as any);
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
        const ms = Date.now() - t0;
        const st = resp?.status?.() ?? 0;
        const text = ((await page.locator("body").innerText().catch(() => "")) || "").trim();
        const ovf = vp.label === "phone" ? await overflowPx(page) : 0;
        const issues: string[] = [];
        if (st >= 400 || st === 0) issues.push(`HTTP ${st}`);
        if (text.length < 40) issues.push("page looks blank");
        if (/Application error|Something went wrong|Internal Server Error/i.test(text)) issues.push("error text on page");
        if (ovf > 1) issues.push(`sideways scroll ${ovf}px`);
        if (ms > 10_000) issues.push(`slow ${Math.round(ms / 1000)}s`);
        const net = problems.filter((p) => !/^exception|^console/.test(p) || true);
        if (net.length) issues.push(...[...new Set(net)].slice(0, 4));
        if (issues.length) bad.push(`${vp.label} ${href} -> ${issues.join("; ")}`);
      }
    }
    if (bad.length) console.log(`\n### ${acct.key}: ${bad.length} problem(s) over ${links.length} pages\n` + bad.map((b) => "  - " + b).join("\n"));
    expect.soft(bad, `problems for ${acct.key}`).toEqual([]);
    await context.close();
  });
}
