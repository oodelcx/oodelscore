"use client";

import type { ReactNode } from "react";

/**
 * Generic side panel (desktop) / bottom sheet (phone width) for a case's
 * Comments or Escalate action — reuses the same pb-slideout-* classes the
 * Playbook run panel already established, so Case Management's actions
 * present consistently instead of some opening a slideout and others
 * opening a plain textarea underneath the row.
 */
export function CaseSidePanel({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="pb-slideout-backdrop" onClick={onClose} />
      <div className="pb-slideout" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pb-slideout-header">
          <div className="pb-slideout-title">{title}</div>
          <button type="button" className="pb-slideout-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="pb-slideout-body">{children}</div>
        {footer && <div className="pb-slideout-footer">{footer}</div>}
      </div>
    </>
  );
}
