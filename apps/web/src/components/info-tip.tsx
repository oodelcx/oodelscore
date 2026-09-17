"use client";

import { useId, useRef, useState, type CSSProperties } from "react";

/**
 * Small (ⓘ) icon with an accessible tooltip popover. Reveals on hover OR
 * keyboard focus (not click), dismisses on mouse-leave/blur or Escape.
 * A real `<button type="button">` so it's keyboard-focusable, with
 * `aria-describedby` pointing at a `role="tooltip"` element.
 *
 * Pass the already-resolved text string (from a server component's
 * `getTooltips()` call) rather than a key — this stays a plain, stateless
 * presentational component with no context/provider involved.
 */
export function InfoTip({ text }: { text: string | undefined }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  if (!text) return null;

  const style: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    verticalAlign: "middle",
    marginLeft: 4,
  };

  return (
    <span
      ref={wrapRef}
      style={style}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="More info"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        style={{
          all: "unset",
          cursor: "help",
          width: 14,
          height: 14,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          lineHeight: 1,
          fontWeight: 700,
          color: "var(--text-3, #9a9a97)",
          border: "1px solid var(--border, #e6e5e1)",
          background: "transparent",
        }}
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            width: "max-content",
            maxWidth: 240,
            padding: "8px 10px",
            borderRadius: 8,
            background: "var(--text, #1a1a18)",
            color: "#fff",
            fontSize: 12,
            lineHeight: 1.4,
            fontWeight: 400,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
