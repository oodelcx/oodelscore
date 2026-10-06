import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent } from "@/lib/siteContent";
import { mergeIndustries } from "@/lib/industries";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { SolutionsView } from "../ds/solutions-view";

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [menu, solutions] = await Promise.all([getSiteContent("menu"), getSiteContent("solutions")]);
  const title = menu.navItems.find((n) => n.key === "solutions")?.label || "Solutions";
  const description = solutions.fields.metaDescription;
  return {
    title,
    description,
    openGraph: { title, description, url: "/solutions", images: ["/og-image.png"] },
    twitter: { title, description, images: ["/og-image.png"] },
  };
}

export default async function SolutionsPage() {
  const [menu, solutions] = await Promise.all([getSiteContent("menu"), getSiteContent("solutions")]);
  if (menu.navItems.find((n) => n.key === "solutions")?.visible === false) notFound();
  const f = solutions.fields;
  return (
    <>
      <MarketingNav active="solutions" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} navLabels={menu.fields} />
      <SolutionsView industries={mergeIndustries(f.industryDetails)} labels={f} ctaHeadline={f.finalCtaHeadline} ctaSub={f.finalCtaSubhead} />
      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
