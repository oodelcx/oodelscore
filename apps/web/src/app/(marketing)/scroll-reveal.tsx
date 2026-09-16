"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shared fade/slide-up reveal on scroll, used across every marketing page
 * instead of each page rolling its own IntersectionObserver. Plain
 * CSS + JS — no animation library. Degrades gracefully (renders visible
 * immediately) if IntersectionObserver isn't available (old browser, or
 * a thumbnail/crawler render), and respects prefers-reduced-motion via
 * the ".reveal" CSS rule below rather than branching here.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay,
}: {
  children: ReactNode;
  as?: "div" | "section";
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Comp = Tag as "div";
  return (
    <Comp ref={ref} className={`reveal${className ? ` ${className}` : ""}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Comp>
  );
}
