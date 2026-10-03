/** Quiet line-art icons for the Company page — same restrained, no-clipart
 * visual language as the rest of the marketing site (nothing else on the
 * marketing site uses icons at all, so these stay minimal: 1.5px stroke,
 * no fill, 28px, currentColor so they pick up each card's accent). Each
 * one is a literal small drawing of its belief, not a generic stock glyph:
 * a closed loop for "act on the score," a balance for "same product at
 * any size," a checkmark inside an eye for "a human reviews it," and a
 * single dot with a direct line for "small and direct." */

import type { ReactElement } from "react";

const common = {
  width: 28,
  height: 28,
  viewBox: "0 0 28 28",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function LoopIcon() {
  return (
    <svg {...common}>
      <path d="M7 11a7 7 0 0 1 13-3.5" />
      <path d="M20 4v4h-4" />
      <path d="M21 17a7 7 0 0 1-13 3.5" />
      <path d="M8 24v-4h4" />
    </svg>
  );
}

export function ScaleIcon() {
  return (
    <svg {...common}>
      <path d="M14 4v18" />
      <path d="M8 8h12" />
      <path d="M8 8 4.5 14.5a3.5 3.5 0 0 0 7 0Z" />
      <path d="M20 8l-3.5 6.5a3.5 3.5 0 0 0 7 0Z" />
      <path d="M10 25h8" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...common}>
      <path d="M14 5c5.2 0 9.6 3.6 11.4 9C23.6 19.4 19.2 23 14 23S4.4 19.4 2.6 14C4.4 8.6 8.8 5 14 5Z" />
      <path d="M10.5 14.3 12.8 16.6 17.6 11.6" />
    </svg>
  );
}

export function SignalIcon() {
  return (
    <svg {...common}>
      <circle cx="14" cy="14" r="2.4" fill="currentColor" stroke="none" />
      <path d="M14 4v4.5" />
      <path d="M14 19.5V24" />
      <path d="M9.5 6.5 11.8 10.3" />
      <path d="M16.2 17.7 18.5 21.5" />
      <path d="M4 14h4.5" />
      <path d="M19.5 14H24" />
    </svg>
  );
}

const ICONS: Record<string, () => ReactElement> = {
  loop: LoopIcon,
  scale: ScaleIcon,
  check: CheckIcon,
  signal: SignalIcon,
};

export function BeliefIcon({ name }: { name: string }) {
  const Icon = ICONS[name] ?? LoopIcon;
  return <Icon />;
}

/** Small per-sector marks for the "Who we build for" strip — a column
 * front for banking, a mortarboard for education, a storefront for
 * retail, a pulse line for healthcare. Same restrained stroke style. */
export function SectorIcon({ slug }: { slug: string }) {
  if (slug === "banking") {
    return (
      <svg {...common} width={24} height={24} viewBox="0 0 24 24">
        <path d="M3 9 12 3l9 6" />
        <path d="M4 9h16v11H4z" />
        <path d="M8 12v5" />
        <path d="M12 12v5" />
        <path d="M16 12v5" />
      </svg>
    );
  }
  if (slug === "education") {
    return (
      <svg {...common} width={24} height={24} viewBox="0 0 24 24">
        <path d="M2 9 12 4l10 5-10 5Z" />
        <path d="M6 11.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" />
        <path d="M22 9v6" />
      </svg>
    );
  }
  if (slug === "retail") {
    return (
      <svg {...common} width={24} height={24} viewBox="0 0 24 24">
        <path d="M3 8 4.5 3h15L21 8" />
        <path d="M3 8h18v13H3Z" />
        <path d="M9 21v-6a3 3 0 0 1 6 0v6" />
      </svg>
    );
  }
  return (
    <svg {...common} width={24} height={24} viewBox="0 0 24 24">
      <path d="M2 13h4l2 5 4-11 2 6h8" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

/** Decorative illustration next to "Our story": four nodes on a single
 * continuous path — the same Listen/Understand/Act/Measure loop the
 * product actually runs, drawn as one unbroken line rather than four
 * disconnected icons, since the point of the story is that it's one
 * loop, not four separate features. Purely decorative — aria-hidden,
 * the real claim is in the text next to it. */
export function StoryIllustration() {
  return (
    <svg
      viewBox="0 0 380 340"
      width="100%"
      fill="none"
      aria-hidden="true"
      style={{ maxWidth: 340 }}
    >
      <path
        d="M190 70 C 250 70, 290 110, 290 170 S 250 270, 190 270 S 90 230, 90 170 S 130 70, 190 70 Z"
        stroke="var(--line)"
        strokeWidth="1.5"
      />
      <path d="M190 70 C 230 70, 260 90, 280 130" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="190" cy="70" r="6" fill="var(--signal)" />
      <circle cx="290" cy="170" r="4" fill="var(--line)" />
      <circle cx="190" cy="270" r="4" fill="var(--line)" />
      <circle cx="90" cy="170" r="4" fill="var(--line)" />
      <text x="190" y="52" fontSize="11" fill="var(--text-2)" textAnchor="middle" fontFamily="var(--font-mono, monospace)">
        LISTEN
      </text>
      <text x="304" y="174" fontSize="11" fill="var(--text-3)" textAnchor="start" fontFamily="var(--font-mono, monospace)">
        UNDERSTAND
      </text>
      <text x="190" y="290" fontSize="11" fill="var(--text-3)" textAnchor="middle" fontFamily="var(--font-mono, monospace)">
        ACT
      </text>
      <text x="76" y="174" fontSize="11" fill="var(--text-3)" textAnchor="end" fontFamily="var(--font-mono, monospace)">
        MEASURE
      </text>
    </svg>
  );
}
