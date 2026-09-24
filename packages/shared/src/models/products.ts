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
