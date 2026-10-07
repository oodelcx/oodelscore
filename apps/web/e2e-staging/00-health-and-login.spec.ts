import { test, expect } from "@playwright/test";
import { ACCOUNTS, assertNotProduction, login } from "./helpers";

test.beforeAll(({}, info) => assertNotProduction(info.project.use.baseURL));

test("health check says the database is connected", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok", mongo: "connected" });
});

for (const acct of ACCOUNTS) {
  test(`login works: ${acct.key}`, async ({ context }) => {
    const { status, body } = await login(context, acct);
    expect(status, JSON.stringify(body)).toBe(200);
  });
}

test("wrong password is refused with a clear message (uses a non-existent address, no lockout risk)", async ({ request }) => {
  const res = await request.post("/api/auth/login", { data: { email: "nobody.qa@showcase.oodel.test", password: "wrong" } });
  expect(res.status()).toBe(401);
  expect((await res.json()).message).toMatch(/invalid/i);
});
