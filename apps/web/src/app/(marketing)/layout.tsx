import type { ReactNode } from "react";
import "./marketing.css";
import { DemoModalProvider } from "./demo-modal";
import { CookieConsentBanner } from "./cookie-consent";

// Marketing pages use the same single global Inter font as the rest of the
// app (dashboards, auth) — set once via next/font in the root layout
// (`app/layout.tsx`) and applied on `<html>`, so it's already inherited
// here. This route group used to load its own Fraunces/Public Sans/IBM
// Plex Mono webfonts, which didn't match the OodelCX logo (a geometric
// grotesque sans close to Inter) — removed, no font loading here anymore.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mkt">
      <DemoModalProvider>{children}</DemoModalProvider>
      <CookieConsentBanner />
    </div>
  );
}
