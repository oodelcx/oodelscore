import { getSiteContent } from "./siteContent";

const DEFAULT_HEADLINE = "Know where you stand. Own where you are going.";
const DEFAULT_HIGHLIGHT = "Own where you are going.";

export interface AuthVisual {
  headline: string;
  highlight: string;
  imageUrl: string;
}

/** Server-side fetch for AuthShell's admin-editable copy — called directly
 * from each auth page's Server Component so the real content is in the
 * first-rendered HTML, never a client fetch that flashes stale defaults. */
export async function getAuthVisual(): Promise<AuthVisual> {
  const content = await getSiteContent("login");
  return {
    headline: content.fields.heroHeadline || DEFAULT_HEADLINE,
    highlight: typeof content.fields.heroHighlight === "string" ? content.fields.heroHighlight : DEFAULT_HIGHLIGHT,
    imageUrl: content.fields.heroImageUrl || "",
  };
}
