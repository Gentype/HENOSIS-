"use client";

import { useEffect, useRef } from "react";

/**
 * Floating "code particles" backdrop.
 *
 * Spawns ~70 short code-snippet glyphs (`</div>`, `const x =`, `=>`, hex
 * colours, …) that drift up the screen in subtle parallax layers, fade out
 * near the top, and respawn at the bottom. The render is a single <canvas>
 * that listens to mouse + touch input on its parent:
 *
 *   – Hover within 110px → particles are pushed away from the cursor
 *     (soft repulsion, magnitude scales with proximity).
 *   – Move the cursor fast enough → nearby particles "crumble": each one
 *     splits into 3–5 tiny fragments that fly outward and fade in ~600ms,
 *     then a fresh particle respawns elsewhere.
 *
 * Pure grayscale (with a hint of sage) so it never fights the foreground.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  text: string;
  size: number;
  alpha: number;
  hue: number; // 0 = gray, 1 = sage tint
  z: number; // depth (0–1) — far particles are smaller, dimmer, slower
}

interface Fragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  size: number;
  life: number; // 1 → 0
  hue: number;
}

const SNIPPETS = [
  "</div>",
  "{ ... }",
  "=>",
  "const",
  "let x =",
  "return",
  "if (",
  "</>", 
  "0x6dd99e",
  "#f5f5f1",
  "import",
  "export",
  ".map(",
  "async",
  "await",
  "fetch(",
  "useState",
  "useEffect",
  "props",
  "tsx",
  "css",
  ".tw-",
  "render()",
  "rgba(",
  "var(",
  "[]",
  "{}",
  "</>",
  "//",
  "/*",
  "*/",
  "100vh",
  "flex",
  "grid",
  "auto",
  "999",
  "null",
  "true",
  ".class",
  "@keyframes",
  ".henosis",
  "<span>",
  "<main>",
];

function pickSnippet(): string {
  return SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)];
}

export function CodeParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const fragmentsRef = useRef<Fragment[]>([]);
  const mouseRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    inside: boolean;
    lastT: number;
  }>({ x: -9999, y: -9999, vx: 0, vy: 0, inside: false, lastT: 0 });
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });
  const rafRef = useRef<number | null>(null);

  // Respect reduced-motion preferences — disable animation entirely.
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
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      // re-scale the drawing context
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(initial = false): Particle {
      const { w, h } = sizeRef.current;
      const z = Math.random();
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + Math.random() * 80,
        vx: (Math.random() - 0.5) * 0.06,
        vy: -(0.08 + Math.random() * 0.18) * (0.5 + z), // far ones slower
        ax: 0,
        ay: 0,
        text: pickSnippet(),
        size: 10 + Math.floor(z * 6),
        alpha: 0,
        hue: Math.random() < 0.2 ? 1 : 0,
        z,
      };
    }

    function populate() {
      const { w } = sizeRef.current;
      const target = Math.max(30, Math.min(90, Math.floor(w / 14)));
      const arr: Particle[] = [];
      for (let i = 0; i < target; i++) arr.push(spawn(true));
      particlesRef.current = arr;
    }

    resize();
    populate();

    const ro = new ResizeObserver(() => {
      resize();
      populate();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function onMove(e: PointerEvent | MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      const m = mouseRef.current;
      const dt = Math.max(1, now - m.lastT);
      m.vx = ((x - m.x) / dt) * 16;
      m.vy = ((y - m.y) / dt) * 16;
      m.x = x;
      m.y = y;
      m.inside = true;
      m.lastT = now;

      // Crumble: if the cursor is moving fast, shred particles near it
      const speed = Math.hypot(m.vx, m.vy);
      if (speed > 8) {
        crumbleNearby(x, y, Math.min(180, 60 + speed * 4));
      }
    }
    function onLeave() {
      mouseRef.current.inside = false;
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    }

    function crumbleNearby(x: number, y: number, radius: number) {
      const particles = particlesRef.current;
      const frags = fragmentsRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const dx = p.x - x;
        const dy = p.y - y;
        const d = Math.hypot(dx, dy);
        if (d > radius) continue;
        // shred into 3-5 fragments
        const pieces = 3 + Math.floor(Math.random() * 3);
        const chars = p.text.length;
        for (let k = 0; k < pieces; k++) {
          const ang = Math.random() * Math.PI * 2;
          const speed = 0.6 + Math.random() * 1.6;
          frags.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed - 0.4,
            text:
              chars > 0
                ? p.text[Math.floor(Math.random() * chars)] || "."
                : ".",
            size: p.size,
            life: 1,
            hue: p.hue,
          });
        }
        particles[i] = spawn(false);
      }
    }

    const parent = canvas.parentElement;
    parent?.addEventListener("pointermove", onMove as EventListener);
    parent?.addEventListener("pointerleave", onLeave);
    parent?.addEventListener("touchmove", (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      onMove(
        new MouseEvent("mousemove", {
          clientX: t.clientX,
          clientY: t.clientY,
        }),
      );
    });

    function tick() {
      if (!canvas || !ctx) return;
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      const m = mouseRef.current;
      const particles = particlesRef.current;
      const frags = fragmentsRef.current;

      // ── particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // soft repulsion from the cursor (inside the parent)
        if (m.inside) {
          const dx = p.x - m.x;
          const dy = p.y - m.y;
          const d2 = dx * dx + dy * dy;
          const radius = 110;
          if (d2 < radius * radius) {
            const d = Math.sqrt(d2) || 0.001;
            const force = (1 - d / radius) * 0.6;
            p.ax += (dx / d) * force;
            p.ay += (dy / d) * force;
          }
        }

        // integrate
        p.vx = p.vx * 0.94 + p.ax;
        p.vy = p.vy * 0.94 + p.ay - 0.02; // permanent upward drift
        p.ax = 0;
        p.ay = 0;
        p.x += p.vx;
        p.y += p.vy;

        // fade in
        p.alpha = Math.min(1, p.alpha + 0.01);

        // wrap horizontally so a strong push doesn't lose them off-screen
        if (p.x < -40) p.x = w + 20;
        if (p.x > w + 40) p.x = -20;

        // respawn near the bottom when they exit the top, or drift down
        if (p.y < -30 || p.y > h + 60) {
          particles[i] = spawn(false);
          continue;
        }

        // draw
        const z = p.z;
        const baseAlpha = (0.18 + z * 0.45) * p.alpha;
        const gray = `rgba(170, 175, 178, ${baseAlpha})`;
        const sage = `rgba(155, 196, 173, ${baseAlpha})`;
        ctx.fillStyle = p.hue === 1 ? sage : gray;
        ctx.font = `${p.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillText(p.text, p.x, p.y);
      }

      // ── fragments
      for (let i = frags.length - 1; i >= 0; i--) {
        const f = frags[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.03; // gentle gravity on debris
        f.vx *= 0.98;
        f.vy *= 0.98;
        f.life -= 0.018;
        if (f.life <= 0) {
          frags.splice(i, 1);
          continue;
        }
        const a = Math.max(0, f.life) * 0.7;
        ctx.fillStyle =
          f.hue === 1
            ? `rgba(155, 196, 173, ${a})`
            : `rgba(180, 184, 188, ${a})`;
        ctx.font = `${f.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillText(f.text, f.x, f.y);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      parent?.removeEventListener("pointermove", onMove as EventListener);
      parent?.removeEventListener("pointerleave", onLeave);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    />
  );
}
