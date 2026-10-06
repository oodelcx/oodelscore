import type { Metadata } from "next";
import { getSiteContent } from "@/lib/siteContent";
import { ProductPage } from "../ds/product-page";

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [menu, content] = await Promise.all([getSiteContent("menu"), getSiteContent("customer-x")]);
  const title = menu.navItems.find((n) => n.key === "customer-x")?.label || content.fields.heroEyebrow || "customer-x";
  const description = content.fields.metaDescription;
  return {
    title,
    description,
    openGraph: { title, description, url: "/customer-x", images: ["/og-image.png"] },
    twitter: { title, description, images: ["/og-image.png"] },
  };
}

export default function Page() {
  return <ProductPage page="customer-x" />;
}
