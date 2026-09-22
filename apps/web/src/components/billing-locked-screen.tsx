/**
 * Renders in place of the portal's own pages once a subscription lapses (or
 * never started, and isn't comp) — the Billing page itself is always let
 * through by the layout that renders this, so there's always a way out.
 */
export function BillingLockedScreen({ billingHref }: { billingHref: string }) {
  return (
    <div style={{ maxWidth: 520, margin: "10vh auto", textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>Your subscription has ended</h1>
      <p className="subtitle" style={{ marginBottom: 24 }}>
        Continue with OodelCX by entering your payment details — everything you&apos;ve collected is safe and picks up
        right where it left off.
      </p>
      <a className="btn btn-dark" href={billingHref}>
        Go to Billing →
      </a>
    </div>
  );
}
