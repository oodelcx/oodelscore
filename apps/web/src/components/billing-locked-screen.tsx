/**
 * Renders in place of the portal's own pages once billing access is denied
 * — the Billing page itself is always let through by the layout that
 * renders this, so there's always a way out. Copy differs by *why* access
 * is denied: a brand-new account that's never been through billing setup
 * reads very differently to a customer than one whose subscription used to
 * be live and has since lapsed.
 */
export function BillingLockedScreen({
  billingHref,
  status = "lapsed",
}: {
  billingHref: string;
  status?: "never_activated" | "lapsed";
}) {
  const copy =
    status === "never_activated"
      ? {
          title: "Let's get your account activated",
          body: "Set up billing to start collecting feedback — this only takes a minute.",
        }
      : {
          title: "Your trial period has ended",
          body: "Please head to the billing section and renew to continue — everything you've collected is safe and picks up right where it left off.",
        };
  return (
    <div style={{ maxWidth: 520, margin: "10vh auto", textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>{copy.title}</h1>
      <p className="subtitle" style={{ marginBottom: 24 }}>
        {copy.body}
      </p>
      <a className="btn btn-dark" href={billingHref}>
        Go to Billing →
      </a>
    </div>
  );
}
