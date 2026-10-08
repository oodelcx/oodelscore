import type { INavItem } from "@oodelscore/shared";

const KEY_BY_PATH: Record<string, string> = {
  "/customer-x": "customer-x",
  "/colleague-x": "colleague-x",
  "/solutions": "solutions",
  "/how-it-works": "how-it-works",
  "/pricing": "pricing",
  "/company": "company",
  "/contact": "contact",
};

/** True when the Admin menu settings hide the page this link points to. Server-safe. */
export function isHiddenByNav(href: string, navItems: INavItem[]): boolean {
  const key = KEY_BY_PATH[href];
  if (!key) return false;
  return navItems.find((n) => n.key === key)?.visible === false;
}
