import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent } from "@/lib/siteContent";
import { MarketingNav, MarketingFooter } from "../nav-footer";
import { Reveal } from "../scroll-reveal";
import { ContactForm } from "./contact-form";

// Otherwise Next statically prerenders this at build time and a Site
// Content edit would never show up without a redeploy.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const contact = await getSiteContent("contact");
  const description = contact.fields.metaDescription;
  return {
    title: "Contact",
    description,
    openGraph: { title: "Contact", description, url: "/contact", images: ["/og-image.png"] },
    twitter: { title: "Contact", description, images: ["/og-image.png"] },
  };
}

export default async function ContactPage() {
  const [menu, contact] = await Promise.all([getSiteContent("menu"), getSiteContent("contact")]);
  if (menu.navItems.find((n) => n.key === "contact")?.visible === false) notFound();
  const f = contact.fields;

  return (
    <>
      <MarketingNav active="contact" navItems={menu.navItems} headerStyle={menu.fields.headerStyle} />

      <section className="inner-hero">
        <div className="wrap">
          <h1>{f.heroHeadline}</h1>
          <p>{f.heroSubhead}</p>
        </div>
      </section>

      <section className="contact-form-section">
        <div className="wrap">
          <Reveal as="div" className="contact-form-card">
            <ContactForm successHeadline={f.successHeadline} successBody={f.successBody} />
          </Reveal>
        </div>
      </section>

      <MarketingFooter fields={menu.fields} navItems={menu.navItems} />
    </>
  );
}
