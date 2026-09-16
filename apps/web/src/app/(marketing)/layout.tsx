import type { ReactNode } from "react";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./marketing.css";
import { DemoModalProvider } from "./demo-modal";

// Marketing-only typography — the rest of the app (dashboards, auth) keeps
// the single global Inter font set in the root layout, which is out of
// scope here. Loaded via next/font (self-hosted, no runtime request to
// Google), scoped to this route group through CSS variables on `.mkt`
// rather than swapped in globally.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-fraunces" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-public-sans" });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-ibm-plex-mono" });

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`mkt ${fraunces.variable} ${publicSans.variable} ${ibmPlexMono.variable}`}>
      <DemoModalProvider>{children}</DemoModalProvider>
    </div>
  );
}
