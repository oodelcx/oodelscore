"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

/**
 * Small (ⓘ) icon with an accessible tooltip popover. Reveals on hover OR
 * keyboard focus (not click), dismisses on mouse-leave/blur or Escape.
 * A real `<button type="button">` so it's keyboard-focusable, with
 * `aria-describedby` pointing at a `role="tooltip"` element.
 *
 * The popover itself is rendered through a portal to `document.body` and
 * positioned from the trigger's `getBoundingClientRect()` (recomputed on
 * scroll/resize while open), clamped to stay inside the viewport. This
 * keeps it from being clipped by, or rendered under, an ancestor with a
 * clipping/stacking context — e.g. a fixed sidebar nav — since it no
 * longer lives inside that ancestor's DOM subtree.
 *
 * Pass the already-resolved text string (from a server component's
 * `getTooltips()` call) rather than a key — this stays a plain, stateless
 * presentational component with no context/provider involved.
 */
const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 8;
const MAX_WIDTH = 240;

interface Position {
  top: number;
  left: number;
  ready: boolean;
}

export function InfoTip({ text }: { text: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, ready: false });
  const id = useId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);

  const reposition = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const btnRect = btn.getBoundingClientRect();
    const tipRect = tipRef.current?.getBoundingClientRect();
    const tipWidth = tipRect?.width ?? MAX_WIDTH;
    const tipHeight = tipRect?.height ?? 34;

    // Prefer above the trigger; flip below if there isn't room.
    let top = btnRect.top - TRIGGER_GAP - tipHeight;
    if (top < VIEWPORT_MARGIN) {
      top = btnRect.bottom + TRIGGER_GAP;
    }
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - VIEWPORT_MARGIN - tipHeight));

    // Center under/over the trigger, clamped within the viewport margins.
    let left = btnRect.left + btnRect.width / 2 - tipWidth / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - VIEWPORT_MARGIN - tipWidth));

    setPos({ top, left, ready: true });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos((p) => (p.ready ? { ...p, ready: false } : p));
      return;
    }
    reposition();
    const onScroll = () => reposition();
    const onResize = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!text) return null;

  const wrapStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    verticalAlign: "middle",
    marginLeft: 4,
  };

  const close = () => setOpen(false);

  return (
    <span style={wrapStyle} onMouseEnter={() => setOpen(true)} onMouseLeave={close}>
      <button
        ref={btnRef}
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="More info"
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: "help",
          width: 13,
          height: 13,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          lineHeight: 1,
          fontWeight: 600,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: open ? "var(--text-2, #68686a)" : "var(--text-3, #9a9a97)",
          background: open ? "var(--border, #e6e5e1)" : "transparent",
          border: "1px solid var(--border, #e6e5e1)",
          transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
        }}
      >
        i
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
              width: "max-content",
              maxWidth: MAX_WIDTH,
              padding: "7px 10px",
              borderRadius: 7,
              background: "var(--text, #1a1a18)",
              color: "#fff",
              fontSize: 12,
              lineHeight: 1.4,
              fontWeight: 400,
              boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
              pointerEvents: "none",
              visibility: pos.ready ? "visible" : "hidden",
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
