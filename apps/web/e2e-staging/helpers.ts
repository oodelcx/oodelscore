import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const PROD_HOSTS = ["oodelcx.com", "www.oodelcx.com"];

/** Refuse to run against production, whatever the environment says. */
export function assertNotProduction(baseURL: string | undefined) {
  const host = new URL(baseURL || "https://oodelscore-staging.onrender.com").hostname;
  if (PROD_HOSTS.includes(host)) throw new Error(`Refusing to run staging checks against production host ${host}`);
}

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "ocx123";

export interface Account {
  key: string;
  email: string;
  password: () => string;
  portal: "admin" | "group" | "business";
}

const demo = (key: string, email: string, portal: Account["portal"]): Account => ({ key, email, password: () => DEMO_PASSWORD, portal });

export const ACCOUNTS: Account[] = [
  { key: "admin", email: "admin.demo@oodelscore.com", password: () => process.env.ADMIN_PASSWORD || "", portal: "admin" },
  demo("group-owner (Meridian)", "owner.meridian@showcase.oodel.test", "group"),
  demo("group-team (Meridian)", "lead.meridian@showcase.oodel.test", "group"),
  demo("branch-owner (Meridian Downtown)", "owner.meridianbankdowntown@showcase.oodel.test", "business"),
  demo("branch-team (Meridian Downtown)", "ops.meridianbankdowntown@showcase.oodel.test", "business"),
  demo("colleague-only group (Skyline)", "owner.skyline@showcase.oodel.test", "group"),
  demo("standalone owner (Olive Table)", "owner.olivetable@showcase.oodel.test", "business"),
  demo("standalone team (Olive Table)", "ops.olivetable@showcase.oodel.test", "business"),
  demo("programme owner (Amani)", "amani@showcase.oodel.test", "business"),
];

/** Logs in through the real login endpoint; the session cookie lands in the browser context. */
export async function login(context: BrowserContext, acct: Account) {
  const password = acct.password();
  if (!password) throw new Error(`No password set for ${acct.key} (set ADMIN_PASSWORD / DEMO_PASSWORD)`);
  const res = await context.request.post("/api/auth/login", { data: { email: acct.email, password } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body };
}

export async function overflowPx(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Collects JS exceptions, console errors and 4xx/5xx responses (favicon excluded) while a page is used. */
export function watchErrors(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`exception: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) problems.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  return problems;
}

export { expect };
export type { APIRequestContext };
