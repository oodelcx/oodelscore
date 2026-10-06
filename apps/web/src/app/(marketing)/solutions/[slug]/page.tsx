import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent } from "@/lib/siteContent";
import { visibleIndustries } from "@/lib/industries";
import { MarketingNav, MarketingFooter } from "../../nav-footer";
import { SolutionsView } from "../../ds/solutions-view";

export const revalidate = 60;

type RouteParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const solutions = await getSiteContent("solutions");
  const industry = visibleIndustries(solutions.fields.industryDetails).find((i) => i.slug === slug);
  if (!industry) return {};
  const title = industry.name;
  const description = industry.cxSub || industry.tileBody || "";
  return {
    title,
    description,
    openGraph: { title, description, url: `/solutions/${slug}`, images: ["/og-image.png"] },
    twitter: { title, description, images: ["/og-image.png"] },
  };
}

export default async function IndustryPage({ params }: RouteParams) {
  const { slug } = await params;
  const [menu, solutions] = await Promise.all([getSiteContent("menu"), getSiteContent("solutions")]);
  if (menu.navItems.find((n) => n.key === "solutions")?.visible === false) notFound();
  const industries = visibleIndustries(solutions.fields.industryDetails);
  if (!industries.some((i) => i.slug === slug)) notFound();
  const f = solutions.fields;
  return (
    <>
      <MarketingNav active="solutions" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} navLabels={menu.fields} />
      <SolutionsView industries={industries} labels={f} initialSlug={slug} ctaHeadline={f.finalCtaHeadline} ctaSub={f.finalCtaSubhead} />
      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
