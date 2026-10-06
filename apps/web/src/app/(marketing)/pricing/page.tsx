import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { PricingView, type Plan } from "../ds/pricing-view";

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [menu, pricing] = await Promise.all([getSiteContent("menu"), getSiteContent("pricing")]);
  const title = menu.navItems.find((n) => n.key === "pricing")?.label || "Pricing";
  const description = pricing.fields.metaDescription;
  return {
    title,
    description,
    openGraph: { title, description, url: "/pricing", images: ["/og-image.png"] },
    twitter: { title, description, images: ["/og-image.png"] },
  };
}

export default async function PricingPage() {
  const [menu, pricing] = await Promise.all([getSiteContent("menu"), getSiteContent("pricing")]);
  if (menu.navItems.find((n) => n.key === "pricing")?.visible === false) notFound();
  const f = pricing.fields;
  return (
    <>
      <MarketingNav active="pricing" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} navLabels={menu.fields} />
      <PricingView
        plans={parseJsonArray<Plan>(f.plans)}
        loopItems={parseJsonArray<{ label: string; body: string }>(f.loopStripItems)}
        labels={f}
      />
      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
