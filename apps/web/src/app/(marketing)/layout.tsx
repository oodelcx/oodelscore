import type { ReactNode } from "react";
import "./marketing.css";
import { DemoModalProvider } from "./demo-modal";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mkt">
      <DemoModalProvider>{children}</DemoModalProvider>
    </div>
  );
}
