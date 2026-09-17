"use client";

import { InfoTip } from "@/components/info-tip";

/**
 * Owner indicator for a Case Management card footer — a small circular
 * avatar with the owner's initials plus their name, or a neutral
 * "Unassigned" state when the case has no owner. Initials are the first
 * letter of the first two words in the label (so "Priya Shah" -> "PS",
 * a single-word label like "Priya" -> "P").
 */
function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function OwnerBadge({ label, tip }: { label: string | null; tip?: string }) {
  const unassigned = !label;
  return (
    <div className="case-owner">
      <span className={`case-owner-avatar${unassigned ? " unassigned" : ""}`}>
        {unassigned ? "—" : initialsFor(label)}
      </span>
      <span className="case-owner-name">{unassigned ? "Unassigned" : label}</span>
      {tip && <InfoTip text={tip} />}
    </div>
  );
}
