"use client";

import { useEffect, useRef } from "react";

/**
 * MeshBackground — Premium animated background for the homepage hero.
 *
 * Layers (back → front):
 * 1. Deep black base with subtle radial warmth at centre
 * 2. Animated mesh gradient blobs (soft organic shapes that morph)
 * 3. Geometric grid with perspective depth
 * 4. Floating orbs with parallax depth
 * 5. Subtle film grain / noise overlay for texture
 * 6. Vignette to focus attention at centre
 *
 * All animations use CSS + requestAnimationFrame for 60fps.
 * Respects prefers-reduced-motion.
 */
export function MeshBackground() {
  return (
    <div className="mesh-bg" aria-hidden>
      {/* Layer 1: Deep radial warmth */}
      <div className="mesh-bg__depth" />

      {/* Layer 2: Morphing mesh gradient blobs */}
      <div className="mesh-bg__mesh">
        <div className="mesh-bg__blob mesh-bg__blob--1" />
        <div className="mesh-bg__blob mesh-bg__blob--2" />
        <div className="mesh-bg__blob mesh-bg__blob--3" />
        <div className="mesh-bg__blob mesh-bg__blob--4" />
        <div className="mesh-bg__blob mesh-bg__blob--5" />
      </div>

      {/* Layer 3: Perspective grid */}
      <div className="mesh-bg__grid" />

      {/* Layer 4: Floating orbs with depth */}
      <FloatingOrbs />

      {/* Layer 5: Film grain */}
      <div className="mesh-bg__noise" />

      {/* Layer 6: Vignette */}
      <div className="mesh-bg__vignette" />

      {/* Layer 7: Top edge light streak */}
      <div className="mesh-bg__streak" />
    </div>
  );
}

/**
 * FloatingOrbs — canvas-based orbs that float at different depths.
 * Mouse parallax: orbs at z=1 move fast, z=0 barely moves.
 */
function FloatingOrbs() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const orbsRef = useRef<Orb[]>([]);
  const rafRef = useRef<number | null>(null);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createOrbs(): Orb[] {
      const parent = canvas!.parentElement;
      if (!parent) return [];
      const rect = parent.getBoundingClientRect();
      const count = Math.max(12, Math.min(28, Math.floor(rect.width / 50)));
      const orbs: Orb[] = [];
      for (let i = 0; i < count; i++) {
        const z = Math.random();
        orbs.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          baseX: Math.random() * rect.width,
          baseY: Math.random() * rect.height,
          radius: 1.5 + z * 3,
          z,
          phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.4,
          alpha: 0.15 + z * 0.4,
          hue: Math.random() < 0.3 ? 1 : 0, // 1 = sage, 0 = white
        });
      }
      return orbs;
    }

    resize();
    orbsRef.current = createOrbs();

    const ro = new ResizeObserver(() => {
      resize();
      orbsRef.current = createOrbs();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function onMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - rect.left) / rect.width;
      mouseRef.current.y = (e.clientY - rect.top) / rect.height;
    }
    window.addEventListener("mousemove", onMove);

    let t = 0;
    function tick() {
      if (!canvas || !ctx) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);
      t += 0.008;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const orb of orbsRef.current) {
        // Gentle float
        const floatX = Math.sin(t * orb.speed + orb.phase) * 30 * orb.z;
        const floatY = Math.cos(t * orb.speed * 0.7 + orb.phase) * 20 * orb.z;

        // Parallax from mouse
        const parallaxX = (mx - 0.5) * 40 * orb.z;
        const parallaxY = (my - 0.5) * 25 * orb.z;

        orb.x = orb.baseX + floatX + parallaxX;
        orb.y = orb.baseY + floatY + parallaxY;

        // Draw
        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, orb.radius * 3
        );

        if (orb.hue === 1) {
          gradient.addColorStop(0, `rgba(184, 227, 201, ${orb.alpha})`);
          gradient.addColorStop(0.5, `rgba(109, 217, 158, ${orb.alpha * 0.4})`);
          gradient.addColorStop(1, "transparent");
        } else {
          gradient.addColorStop(0, `rgba(255, 255, 255, ${orb.alpha})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${orb.alpha * 0.3})`);
          gradient.addColorStop(1, "transparent");
        }

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Crisp core
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = orb.hue === 1
          ? `rgba(184, 227, 201, ${orb.alpha * 1.2})`
          : `rgba(255, 255, 255, ${orb.alpha * 1.1})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 3 }}
    />
  );
}

interface Orb {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  z: number;
  phase: number;
  speed: number;
  alpha: number;
  hue: number;
}
