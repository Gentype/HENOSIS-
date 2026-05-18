"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface LiveBuilderProps {
  /** The raw partial JSON streaming back from /api/generate. */
  partial: string;
}

/**
 * Centered "live mode" indicator shown while the AI is writing the site.
 *
 * Reads the partial JSON stream and figures out which file is currently
 * being written, then renders a giant language badge (HTML / CSS / TS / JS /
 * JSON / MD / SVG …) in the middle of the preview pane. The badges shift
 * with smooth crossfades + a slow ambient bob so the page never feels
 * static, even when the model spends a few seconds on a single file.
 */
export function LiveBuilder({ partial }: LiveBuilderProps) {
  // Extract every "path":"…" the model has emitted so far. The last one is
  // the file currently being written.
  const current = useMemo(() => extractCurrentPath(partial), [partial]);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (!current) return;
    setHistory((prev) => (prev[prev.length - 1] === current ? prev : [...prev, current]));
  }, [current]);

  const lang = inferLang(current);
  const recent = history.slice(-5);

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      {/* ambient rings behind the badge */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="lb-ring lb-ring-1" aria-hidden />
        <div className="lb-ring lb-ring-2" aria-hidden />
        <div className="lb-ring lb-ring-3" aria-hidden />
      </div>

      <div className="relative grid place-items-center py-6 sm:py-10">
        <LangBadge key={lang.id} lang={lang} />
      </div>

      <div className="relative mt-2 text-center">
        <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">
          Live build · {history.length} file{history.length === 1 ? "" : "s"}
        </div>
        <div className="mt-2 text-sm font-mono text-foreground truncate">
          {current ? (
            <>
              <span className="text-accent">›</span> {current}
              <span className="ml-1 inline-block align-middle w-1.5 h-3.5 bg-accent/70 rounded-sm caret-blink" />
            </>
          ) : (
            <span className="text-muted">Thinking through the layout…</span>
          )}
        </div>
        {recent.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5 flex-wrap">
            {recent.map((p, i) => {
              const l = inferLang(p);
              const isCurrent = i === recent.length - 1;
              return (
                <span
                  key={`${p}-${i}`}
                  title={p}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono",
                    "border border-border bg-surface/80",
                    isCurrent ? "border-accent/50 text-accent" : "text-subtle",
                  )}
                  style={{ color: isCurrent ? undefined : l.dim }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-sm"
                    style={{ background: l.color }}
                  />
                  {shortenPath(p)}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface Lang {
  id: string;
  label: string;
  short: string;
  color: string;
  dim: string;
  gradient: string;
}

const LANGS: Record<string, Lang> = {
  html: {
    id: "html",
    label: "HTML",
    short: "HTML",
    color: "#e34f26",
    dim: "rgba(227, 79, 38, 0.6)",
    gradient: "linear-gradient(180deg, #f06529 0%, #c93420 100%)",
  },
  css: {
    id: "css",
    label: "CSS",
    short: "CSS",
    color: "#2965f1",
    dim: "rgba(41, 101, 241, 0.6)",
    gradient: "linear-gradient(180deg, #5a9bff 0%, #1e4fd4 100%)",
  },
  ts: {
    id: "ts",
    label: "TypeScript",
    short: "TS",
    color: "#3178c6",
    dim: "rgba(49, 120, 198, 0.6)",
    gradient: "linear-gradient(180deg, #5fa6e6 0%, #1f5da3 100%)",
  },
  tsx: {
    id: "tsx",
    label: "TypeScript JSX",
    short: "TSX",
    color: "#3178c6",
    dim: "rgba(49, 120, 198, 0.6)",
    gradient: "linear-gradient(180deg, #5fa6e6 0%, #1f5da3 100%)",
  },
  js: {
    id: "js",
    label: "JavaScript",
    short: "JS",
    color: "#f7df1e",
    dim: "rgba(247, 223, 30, 0.6)",
    gradient: "linear-gradient(180deg, #ffe93d 0%, #d8be1a 100%)",
  },
  jsx: {
    id: "jsx",
    label: "JavaScript JSX",
    short: "JSX",
    color: "#f7df1e",
    dim: "rgba(247, 223, 30, 0.6)",
    gradient: "linear-gradient(180deg, #ffe93d 0%, #d8be1a 100%)",
  },
  json: {
    id: "json",
    label: "JSON",
    short: "JSON",
    color: "#a3a3a3",
    dim: "rgba(163, 163, 163, 0.6)",
    gradient: "linear-gradient(180deg, #c5c5c5 0%, #6f6f6f 100%)",
  },
  md: {
    id: "md",
    label: "Markdown",
    short: "MD",
    color: "#6dd99e",
    dim: "rgba(109, 217, 158, 0.6)",
    gradient: "linear-gradient(180deg, #b8e3c9 0%, #4eb87f 100%)",
  },
  svg: {
    id: "svg",
    label: "SVG",
    short: "SVG",
    color: "#ff9800",
    dim: "rgba(255, 152, 0, 0.6)",
    gradient: "linear-gradient(180deg, #ffb74d 0%, #e65100 100%)",
  },
  py: {
    id: "py",
    label: "Python",
    short: "PY",
    color: "#3776ab",
    dim: "rgba(55, 118, 171, 0.6)",
    gradient: "linear-gradient(180deg, #4b8bbe 0%, #ffe873 100%)",
  },
  unknown: {
    id: "unknown",
    label: "File",
    short: "FILE",
    color: "#b8e3c9",
    dim: "rgba(184, 227, 201, 0.6)",
    gradient: "linear-gradient(180deg, #b8e3c9 0%, #6dd99e 100%)",
  },
};

function inferLang(path: string | null): Lang {
  if (!path) return LANGS.unknown;
  const lower = path.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return LANGS.html;
  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".less")) return LANGS.css;
  if (lower.endsWith(".tsx")) return LANGS.tsx;
  if (lower.endsWith(".ts")) return LANGS.ts;
  if (lower.endsWith(".jsx")) return LANGS.jsx;
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return LANGS.js;
  if (lower.endsWith(".json")) return LANGS.json;
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return LANGS.md;
  if (lower.endsWith(".svg")) return LANGS.svg;
  if (lower.endsWith(".py")) return LANGS.py;
  return LANGS.unknown;
}

function extractCurrentPath(stream: string): string | null {
  if (!stream) return null;
  // walk the stream backwards, find the most recent "path":"…"
  const regex = /"path"\s*:\s*"([^"]{1,200})"/g;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(stream))) {
    last = m[1];
  }
  return last;
}

function shortenPath(p: string): string {
  if (p.length <= 22) return p;
  return `…${p.slice(-21)}`;
}

function LangBadge({ lang }: { lang: Lang }) {
  const sizeClass = lang.short.length >= 4 ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl";
  return (
    <div
      className="lb-badge relative grid place-items-center rounded-3xl shadow-2xl shadow-black/70"
      style={{
        background: lang.gradient,
        width: "min(160px, 40vw)",
        height: "min(160px, 40vw)",
        boxShadow: `0 30px 80px -10px ${lang.dim}, inset 0 0 0 1px rgba(255,255,255,0.12)`,
      }}
    >
      <div
        className={cn(
          "font-mono font-extrabold text-white tracking-tight drop-shadow",
          sizeClass,
        )}
        style={{
          textShadow: "0 2px 18px rgba(0,0,0,0.45)",
        }}
      >
        {lang.short}
      </div>
      <div className="absolute inset-0 rounded-3xl pointer-events-none lb-badge-shine" />
      <div
        className="absolute -inset-4 rounded-[28px] pointer-events-none blur-2xl opacity-40"
        style={{ background: lang.gradient }}
        aria-hidden
      />
    </div>
  );
}
