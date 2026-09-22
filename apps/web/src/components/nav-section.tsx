"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * A collapsible sidebar nav group — cleanup for the Business/Group portals'
 * flat ~17-item nav (spec Phase 3 item 12: "role-scoped navigation"),
 * scoped down to what the existing account model actually supports rather
 * than inventing new personas the mockup doesn't have. Collapsed-by-default
 * sections shrink the list without hiding anything; a user's open/closed
 * choice is remembered per-browser, and a section is always forced open
 * when the page they're currently on lives inside it.
 */
export function NavSection({
  storageKey,
  label,
  defaultOpen = true,
  hrefs,
  children,
}: {
  storageKey: string;
  label: string;
  defaultOpen?: boolean;
  hrefs: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
  const [open, setOpen] = useState(defaultOpen || isActive);

  useEffect(() => {
    if (isActive) {
      setOpen(true);
      return;
    }
    try {
      const stored = localStorage.getItem(`nav-section:${storageKey}`);
      if (stored !== null) setOpen(stored === "1");
    } catch {
      // private window / blocked storage — fall back to defaultOpen
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(`nav-section:${storageKey}`, next ? "1" : "0");
    } catch {
      // ignore — this is a per-viewer convenience, not durable state
    }
  }

  return (
    <>
      <button type="button" className="nav-group-label nav-group-toggle" onClick={toggle} aria-expanded={open}>
        {label}
        <span className="nav-group-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && <nav className="admin-nav">{children}</nav>}
    </>
  );
}
