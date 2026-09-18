"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { TourDefinition } from "./tour-types";

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_MARGIN = 14;
const TOOLTIP_WIDTH = 320;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function CoachMark({
  definition,
  stepIndex,
  onStepChange,
  onDone,
}: {
  definition: TourDefinition;
  stepIndex: number;
  onStepChange: (nextIndex: number) => void;
  onDone: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const step = definition.steps[stepIndex];

  useEffect(() => {
    setReady(false);
    const el = step ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    if (!step || !el) {
      // Target isn't on this page (conditional content, different scroll
      // position, etc.) — skip straight past it instead of showing a
      // spotlight pointing at nothing.
      if (stepIndex < definition.steps.length - 1) onStepChange(stepIndex + 1);
      else onDone();
      return;
    }

    const target: Element = el;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    const settle = window.setTimeout(() => {
      setRect(measure(target));
      setReady(true);
    }, 320);

    function reposition() {
      setRect(measure(target));
    }
    window.addEventListener("resize", reposition);
    const scrollParent = document.querySelector(".admin-main");
    scrollParent?.addEventListener("scroll", reposition, { passive: true });

    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("resize", reposition);
      scrollParent?.removeEventListener("scroll", reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, definition]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const tooltipStyle = useMemo(() => {
    if (!rect || typeof window === "undefined") return null;
    const requested = step?.placement ?? "bottom";
    const roomLeft = rect.left - SPOTLIGHT_PADDING - TOOLTIP_MARGIN;
    const roomRight = window.innerWidth - (rect.left + rect.width + SPOTLIGHT_PADDING + TOOLTIP_MARGIN);
    // A side placement only makes sense if the tooltip actually fits beside
    // the target — a near-full-width card with placement:"left"/"right"
    // would otherwise push the whole tooltip (Next/Back/Skip included) off
    // the edge of the screen entirely. Fall back to "bottom" instead of
    // clamping into an unusably narrow/overlapping position.
    const placement =
      (requested === "left" && roomLeft < TOOLTIP_WIDTH) || (requested === "right" && roomRight < TOOLTIP_WIDTH)
        ? "bottom"
        : requested;

    // The tooltip's own height varies with content, so this is a
    // conservative reserve rather than a measured value — good enough to
    // keep the (fixed-height) Next/Back/Skip row from clamping off-screen,
    // which is the failure mode that actually matters here.
    const ESTIMATED_HEIGHT = 190;
    const style: Record<string, number | string> = { position: "fixed", width: TOOLTIP_WIDTH };
    const clampLeft = (v: number) => clamp(v, 16, window.innerWidth - TOOLTIP_WIDTH - 16);
    const clampTopAnchored = (v: number) => clamp(v, 16, window.innerHeight - ESTIMATED_HEIGHT - 16);
    const clampBottomAnchored = (v: number) => clamp(v, ESTIMATED_HEIGHT + 16, window.innerHeight - 16);

    if (placement === "bottom") {
      style.top = clampTopAnchored(rect.top + rect.height + SPOTLIGHT_PADDING + TOOLTIP_MARGIN);
      style.left = clampLeft(rect.left);
    } else if (placement === "top") {
      style.top = clampBottomAnchored(rect.top - SPOTLIGHT_PADDING - TOOLTIP_MARGIN);
      style.left = clampLeft(rect.left);
      style.transform = "translateY(-100%)";
    } else if (placement === "left") {
      style.top = clampTopAnchored(rect.top);
      style.left = clampLeft(rect.left - TOOLTIP_WIDTH - SPOTLIGHT_PADDING - TOOLTIP_MARGIN);
    } else {
      style.top = clampTopAnchored(rect.top);
      style.left = clampLeft(rect.left + rect.width + SPOTLIGHT_PADDING + TOOLTIP_MARGIN);
    }
    return style;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, step]);

  if (!step || typeof document === "undefined") return null;

  const isLast = stepIndex === definition.steps.length - 1;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999 }} aria-live="polite">
      {/* Dimmed backdrop with a spotlight cutout at the target — the
          box-shadow-as-mask trick avoids needing an SVG mask/clip-path for
          a shape that has to track an arbitrary element's rect. */}
      <div
        style={{
          position: "fixed",
          top: rect ? rect.top - SPOTLIGHT_PADDING : 0,
          left: rect ? rect.left - SPOTLIGHT_PADDING : 0,
          width: rect ? rect.width + SPOTLIGHT_PADDING * 2 : 0,
          height: rect ? rect.height + SPOTLIGHT_PADDING * 2 : 0,
          borderRadius: 10,
          boxShadow: "0 0 0 9999px rgba(15, 17, 19, 0.62)",
          transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
          opacity: ready ? 1 : 0,
          pointerEvents: "none",
        }}
      />
      {ready && tooltipStyle && (
        <div
          style={{
            ...tooltipStyle,
            background: "#15181b",
            color: "#f0f0ee",
            borderRadius: 12,
            padding: "16px 18px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          }}
        >
          <div style={{ fontSize: 11, color: "#8b9096", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Step {stepIndex + 1} of {definition.steps.length}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, margin: "6px 0 6px" }}>{step.title}</div>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#c4c7cb", margin: "0 0 14px" }}>{step.body}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              onClick={onDone}
              style={{ fontSize: 12, color: "#8b9096", cursor: "pointer" }}
            >
              Skip tour
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {stepIndex > 0 && (
                <button
                  onClick={() => onStepChange(stepIndex - 1)}
                  style={buttonStyle(false)}
                >
                  Back
                </button>
              )}
              <button onClick={() => (isLast ? onDone() : onStepChange(stepIndex + 1))} style={buttonStyle(true)}>
                {isLast ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function buttonStyle(primary: boolean): CSSProperties {
  return {
    fontSize: 12.5,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 7,
    border: primary ? "none" : "1px solid #3a3c40",
    background: primary ? "#3fbe8b" : "transparent",
    color: primary ? "#0a1f16" : "#f0f0ee",
    cursor: "pointer",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
