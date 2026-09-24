/**
 * The two product lines a Business/ParentOrganization can be enabled for.
 * Colleague Experience is the second product line being built out
 * alongside the original Customer Experience product — everything that
 * predates this field is implicitly Customer Experience.
 */
export const PRODUCTS = ["customer_experience", "colleague_experience"] as const;
export type Product = (typeof PRODUCTS)[number];

export const DEFAULT_ENABLED_PRODUCTS: Product[] = ["customer_experience"];

/**
 * enabledProducts is null on every record created before this field
 * existed — that must resolve to Customer Experience only, never "all
 * products", since Colleague Experience isn't a real, sellable product yet.
 * Always read enabledProducts through this helper rather than the raw
 * field so that meaning lives in one place.
 */
export function getEnabledProducts(entity: { enabledProducts?: Product[] | null }): Product[] {
  return entity.enabledProducts && entity.enabledProducts.length > 0 ? entity.enabledProducts : DEFAULT_ENABLED_PRODUCTS;
}

export function hasProduct(entity: { enabledProducts?: Product[] | null }, product: Product): boolean {
  return getEnabledProducts(entity).includes(product);
}

/**
 * Which product a page that can only show one metric set at a time (e.g.
 * Command Center's client tiles, built long before Colleague Experience
 * existed and never re-scoped) should compute against. Customer Experience
 * wins when both are enabled — same "CX is the default until a page
 * explicitly supports both" rule the rest of this migration follows — but
 * an account with Colleague Experience only must never fall through to
 * Customer Experience just because that's the hardcoded default everywhere
 * else; it would silently show blank/stale numbers for a product the
 * account doesn't even have.
 */
export function primaryProductFor(entity: { enabledProducts?: Product[] | null }): Product {
  return hasProduct(entity, "customer_experience") ? "customer_experience" : "colleague_experience";
}

/**
 * The per-person analogue of getEnabledProducts() above, for a team member's
 * own `products` field. Same reasoning, same default: null/empty always
 * means Customer Experience only, never "whatever the business has."
 */
export function getTeamMemberProducts(teamMember: { products?: Product[] | null }): Product[] {
  return teamMember.products && teamMember.products.length > 0 ? teamMember.products : DEFAULT_ENABLED_PRODUCTS;
}

/**
 * A person can actually use a product only if both gates say yes: the
 * business/org bought it, AND this specific person was granted it. Either
 * gate alone is meaningless — see the CE Phase 3 admin screen this backs.
 */
export function personHasProduct(
  business: { enabledProducts?: Product[] | null },
  teamMember: { products?: Product[] | null },
  product: Product
): boolean {
  return hasProduct(business, product) && getTeamMemberProducts(teamMember).includes(product);
}
