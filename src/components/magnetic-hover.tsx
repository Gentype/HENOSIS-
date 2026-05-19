"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MagneticHoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum displacement in px the child is allowed to drift. Default 12. */
  strength?: number;
  /** Spring smoothing — higher values = snappier follow. Default 0.18. */
  smoothing?: number;
  /** Disable the magnetic effect (still renders the wrapper). */
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * MagneticHover — wraps an interactive element so that when the cursor
 * enters its bounding box, the element drifts toward the cursor up to
 * `strength` px. On leave it springs back to centre.
 *
 * Used on key CTAs and the hero prompt box surround so the home page
 * has the "alive on hover" feel users get on linear.app / raycast.com.
 *
 * The transform is applied to the wrapper div, not the child, so
 * children like our `<button className="btn-generate">` don't have to
 * be aware of it. The wrapper inherits the child's hit area via
 * `inline-block` + `display:contents`-like usage.
 *
 * Honours prefers-reduced-motion and skips on touch devices.
 */
export function MagneticHover({
  strength = 12,
  smoothing = 0.18,
  disabled,
  children,
  className,
  style,
  ...rest
}: MagneticHoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const tick = useCallback(() => {
    const dx = targetRef.current.x - currentRef.current.x;
    const dy = targetRef.current.y - currentRef.current.y;
    currentRef.current.x += dx * smoothing;
    currentRef.current.y += dy * smoothing;
    if (ref.current) {
      ref.current.style.transform = `translate3d(${currentRef.current.x.toFixed(2)}px, ${currentRef.current.y.toFixed(2)}px, 0)`;
    }
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  }, [smoothing]);

  const start = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Skip on touch devices (no hover signal) and when reduced motion is on.
  const skip =
    disabled ||
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (skip || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nx = (e.clientX - cx) / (rect.width / 2);
    const ny = (e.clientY - cy) / (rect.height / 2);
    targetRef.current.x = Math.max(-1, Math.min(1, nx)) * strength;
    targetRef.current.y = Math.max(-1, Math.min(1, ny)) * strength;
    start();
  }

  function onLeave() {
    targetRef.current.x = 0;
    targetRef.current.y = 0;
    setActive(false);
    start();
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={onLeave}
      className={cn(
        "inline-block will-change-transform transition-shadow duration-300",
        active && !skip && "drop-shadow-[0_0_30px_rgba(184,227,201,0.35)]",
        className,
      )}
      style={{
        transition:
          "transform 0.45s cubic-bezier(0.2,0.8,0.2,1), filter 0.3s ease",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
