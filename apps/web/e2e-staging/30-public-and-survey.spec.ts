import { test, expect } from "@playwright/test";
import { ACCOUNTS, assertNotProduction, login, overflowPx, watchErrors } from "./helpers";

test.beforeAll(({}, info) => assertNotProduction(info.project.use.baseURL));

const PUBLIC_PAGES = ["/", "/customer-x", "/colleague-x", "/solutions", "/solutions/banking", "/solutions/education", "/solutions/retail", "/solutions/healthcare", "/company", "/privacy", "/terms", "/login"];

for (const path of PUBLIC_PAGES) {
  for (const vp of [{ w: 1280, h: 800, l: "desktop" }, { w: 390, h: 844, l: "phone" }]) {
    test(`public page ${path} (${vp.l}): loads clean, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      const problems = watchErrors(page);
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      expect(resp?.status()).toBe(200);
      expect(problems, problems.join("\n")).toEqual([]);
      if (vp.l === "phone") expect(await overflowPx(page)).toBeLessThanOrEqual(1);
    });
  }
}

test("Pricing is switched off: page is a 404 and no link on the home page points at it", async ({ page }) => {
  const res = await page.goto("/pricing");
  expect(res?.status()).toBe(404);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const links = await page.$$eval('a[href="/pricing"]', (a) => a.map((x) => x.textContent?.trim()));
  expect(links, "links that lead to the switched-off Pricing page").toEqual([]);
});

test("a demo request can be opened from the home page (form shows; nothing is sent)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /book a demo/i }).first().click();
  await expect(page.getByRole("dialog").or(page.locator("form")).first()).toBeVisible();
});

test("customer survey form opens from a QR link in both desktop and phone width", async ({ browser, baseURL }) => {
  const owner = ACCOUNTS.find((a) => a.key.startsWith("branch-owner"))!;
  const context = await browser.newContext({ baseURL });
  expect((await login(context, owner)).status).toBe(200);
  const fps = (await (await context.request.get("/api/business/feedback-points?product=customer_experience")).json()).feedbackPoints as any[];
  const fp = fps.find((f) => f.active && f.qrToken);
  expect(fp, "an active feedback point with a QR token").toBeTruthy();
  await context.close();

  // The public API behind the form must not leak the internal business record (security fix PR #160).
  const raw = await (await browser.newContext({ baseURL })).request.get(`/api/feedback/${fp.qrToken}`);
  expect(raw.status()).toBe(200);
  const text = await raw.text();
  for (const secret of ["passwordHash", "stripeCustomerId", "billingAssignment", "sensitiveRoutingContactId", "accountManagerId"]) {
    expect(text, `public survey payload leaks "${secret}"`).not.toContain(secret);
  }

  for (const vp of [{ w: 1280, h: 800 }, { w: 390, h: 844 }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, baseURL });
    const problems = watchErrors(page);
    // Opening the form is a scan; scan counters on staging demo data are not meaningful.
    const resp = await page.goto(`/feedback/${fp.qrToken}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(resp?.status()).toBe(200);
    expect((await page.locator("body").innerText()).length).toBeGreaterThan(60);
    expect(problems, problems.join("\n")).toEqual([]);
    expect(await overflowPx(page)).toBeLessThanOrEqual(1);
    await page.close();
  }
});
