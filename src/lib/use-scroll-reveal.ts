"use client";

import { useEffect } from "react";

/**
 * useScrollReveal — single IntersectionObserver that watches every
 * `.scroll-reveal` element on the page and toggles `.in` on first
 * intersect. Disconnects per-element on reveal so each only animates
 * once. Honours prefers-reduced-motion via the matching CSS rule.
 *
 * Mount once per page (App.tsx / page.tsx for marketing pages).
 */
export function useScrollReveal(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      document
        .querySelectorAll(".scroll-reveal")
        .forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );
    document
      .querySelectorAll(".scroll-reveal")
      .forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
