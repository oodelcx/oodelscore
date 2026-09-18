"use client";

import { InfoTip } from "@/components/info-tip";

/**
 * Owner indicator for a Case Management card footer — a small circular
 * avatar with the owner's initials plus their name, or a neutral
 * "Unassigned" state when the case has no owner.
 *
 * `label` isn't always a clean "First Last" name — the team-list APIs
 * (`/api/{business,group}/team`) build it as a dropdown-style string, e.g.
 * `"regional.ops@showcase.oodel.test (Meridian Bank Group, Regional
 * Operations Lead)"`. Showing that whole string as the visible name, and
 * splitting it on whitespace for initials, produces exactly the garbage
 * this component used to render ("R(" initials, a wall of text). So this
 * derives a short display name first — the part before " (", and before
 * "@" if what's left still looks like an email — and only shows the full
 * original label as a native title-attribute tooltip on hover, not inline.
 */
function shortDisplayName(label: string): string {
  const beforeParen = label.split(" (")[0]!.trim();
  const atIndex = beforeParen.indexOf("@");
  return atIndex > 0 ? beforeParen.slice(0, atIndex) : beforeParen;
}

function initialsFor(shortName: string): string {
  const parts = shortName
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function OwnerBadge({ label, tip }: { label: string | null; tip?: string }) {
  const unassigned = !label;
  const shortName = label ? shortDisplayName(label) : "";
  return (
    <div className="case-owner">
      <span className={`case-owner-avatar${unassigned ? " unassigned" : ""}`}>
        {unassigned ? "—" : initialsFor(shortName)}
      </span>
      <span className="case-owner-name" title={label ?? undefined}>
        {unassigned ? "Unassigned" : shortName}
      </span>
      {tip && <InfoTip text={tip} />}
    </div>
  );
}
