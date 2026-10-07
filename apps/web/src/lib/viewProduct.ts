import { cookies } from "next/headers";
import { PRODUCTS, hasProduct, primaryProductFor, type Product } from "@oodelscore/shared";

// Lets an account with BOTH products enabled pick which one's aggregate
// dashboards (Overview, Command Center, Branches, Compare, Regions,
// Reports) they're currently looking at, via ProductViewSwitcher. Falls
// back to primaryProductFor's default (customer_experience when enabled,
// else colleague_experience) whenever there's no cookie, an invalid one,
// or the account doesn't actually have the cookie's product enabled —
// so a stale cookie from a previous account can never leak a product view
// that account isn't entitled to.
export const VIEW_PRODUCT_COOKIE = "oodel_view_product";

const PRODUCT_SET: readonly string[] = PRODUCTS;

export async function resolveViewProduct(entity: { enabledProducts?: Product[] | null }): Promise<Product> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(VIEW_PRODUCT_COOKIE)?.value;
  if (raw && PRODUCT_SET.includes(raw) && hasProduct(entity, raw as Product)) {
    return raw as Product;
  }
  return primaryProductFor(entity);
}

/**
 * Analytics and Insights are Customer Experience pages (customer wording,
 * CX goals, customer-effort boxes); the menu already hides them for
 * Colleague Experience. This is the server-side half — without it a
 * colleague user could still open them by typing the address. Returns true
 * when the page/API may be used.
 */
export async function isCustomerViewProduct(entity: { enabledProducts?: Product[] | null }): Promise<boolean> {
  return hasProduct(entity, "customer_experience") && (await resolveViewProduct(entity)) === "customer_experience";
}
