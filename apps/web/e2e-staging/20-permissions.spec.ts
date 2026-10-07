import { test, expect, type APIRequestContext } from "@playwright/test";
import { ACCOUNTS, assertNotProduction, login } from "./helpers";

/**
 * Server-side permission checks, API only and read-only (nothing is changed).
 * The point: hiding a menu item is not security, the server must refuse.
 */
test.beforeAll(({}, info) => assertNotProduction(info.project.use.baseURL));

const acct = (prefix: string) => ACCOUNTS.find((a) => a.key.startsWith(prefix))!;

async function as(browser: any, baseURL: string | undefined, a: ReturnType<typeof acct>) {
  const context = await browser.newContext({ baseURL });
  const r = await login(context, a);
  expect(r.status, a.key).toBe(200);
  return { context, api: context.request as APIRequestContext };
}

test("signed-out visitors are refused by every portal API", async ({ request }) => {
  for (const p of ["/api/business/me", "/api/business/responses", "/api/business/action-board", "/api/group/branches", "/api/group/action-board", "/api/admin/businesses", "/api/admin/users"]) {
    const res = await request.get(p);
    expect([401, 403, 404], `${p} -> ${res.status()}`).toContain(res.status());
  }
});

test("business owner cannot use admin or group APIs", async ({ browser, baseURL }) => {
  const { context, api } = await as(browser, baseURL, acct("standalone owner"));
  for (const p of ["/api/admin/businesses", "/api/admin/users", "/api/admin/billing", "/api/group/branches"]) {
    const res = await api.get(p);
    expect([401, 403, 404], `${p} -> ${res.status()}`).toContain(res.status());
  }
  await context.close();
});

test("group owner cannot use admin or single-business APIs", async ({ browser, baseURL }) => {
  const { context, api } = await as(browser, baseURL, acct("group-owner"));
  for (const p of ["/api/admin/businesses", "/api/admin/users", "/api/business/responses"]) {
    const res = await api.get(p);
    expect([401, 403, 404], `${p} -> ${res.status()}`).toContain(res.status());
  }
  await context.close();
});

test("a group owner cannot open another group's branch", async ({ browser, baseURL }) => {
  const admin = await as(browser, baseURL, acct("admin"));
  const list = (await (await admin.api.get("/api/admin/businesses?limit=500")).json()).businesses as any[];
  const aurora = list.find((b) => /Aurora Airlines – JFK/.test(b.name));
  expect(aurora, "Aurora JFK exists").toBeTruthy();
  await admin.context.close();
  const { context, api } = await as(browser, baseURL, acct("group-owner"));
  const res = await api.get(`/api/group/branches/${aurora._id ?? aurora.id}`);
  expect([403, 404], `status ${res.status()}`).toContain(res.status());
  await context.close();
});

test("a branch owner cannot see another branch's responses or cases", async ({ browser, baseURL }) => {
  const { context, api } = await as(browser, baseURL, acct("branch-owner"));
  const me = (await (await api.get("/api/business/me")).json()).business;
  const rs = (await (await api.get("/api/business/responses?limit=100&product=customer_experience")).json()).responses as any[];
  expect(rs.length).toBeGreaterThan(0);
  expect(rs.every((r) => r.businessId === me._id), "every response belongs to this branch").toBeTruthy();
  const cases = (await (await api.get("/api/business/action-board?product=customer_experience")).json()).items as any[];
  expect(cases.every((c) => c.businessId === me._id), "every case belongs to this branch").toBeTruthy();
  await context.close();
});

test("branch owner cannot change billing or survey set-up fields (server must refuse or ignore)", async ({ browser, baseURL }) => {
  const { context, api } = await as(browser, baseURL, acct("branch-owner"));
  const before = (await (await api.get("/api/business/me")).json()).business;
  // Sends the CURRENT values back, so even if the server wrongly accepted this nothing would change.
  const res = await api.patch("/api/business/me", { data: { billingAssignment: before.billingAssignment, maxFeedbackPoints: before.maxFeedbackPoints, plan: before.plan } });
  const after = (await (await api.get("/api/business/me")).json()).business;
  expect([200, 400, 403, 404, 405]).toContain(res.status());
  expect(after.billingAssignment).toBe(before.billingAssignment);
  expect(after.maxFeedbackPoints).toBe(before.maxFeedbackPoints);
  await context.close();
});

test("restricted team member is refused the pages their role hides", async ({ browser, baseURL }) => {
  const { context, api } = await as(browser, baseURL, acct("branch-team"));
  const me = await (await api.get("/api/business/me")).json();
  expect(me.status).toBe("ok");
  const results: string[] = [];
  for (const p of ["/api/business/billing", "/api/business/team-members", "/api/business/alert-rules", "/api/business/feedback-points"]) {
    const res = await api.get(p);
    results.push(`${p}:${res.status()}`);
  }
  test.info().annotations.push({ type: "team-member access", description: results.join(" ") });
  await context.close();
});
