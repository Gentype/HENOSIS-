"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles, Crown, Wand2, Check, X } from "lucide-react";
import { MODELS } from "@/lib/examples";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}

function findKnown(id: string) {
  return MODELS.find((m) => m.id === id);
}

function labelFor(id: string) {
  const m = findKnown(id);
  if (m) return m.label;
  // Friendly fallback for custom OpenRouter ids like "provider/model-name".
  const tail = id.split("/").pop() ?? id;
  return tail
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ModelSelector({ value, onChange, compact = false }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const known = findKnown(value);
  const isCustom = !known;

  // close on outside click / Escape (mouse + touch)
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: Event) => {
      const target = e.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  function applyCustom() {
    const raw = customInput.trim();
    if (raw.length < 3) return;
    pick(raw);
    setCustomInput("");
  }

  const currentLabel = labelFor(value);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 backdrop-blur",
          "hover:bg-surface hover:border-border-strong transition-all",
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        )}
      >
        <Sparkles
          className={cn("text-accent", compact ? "w-3.5 h-3.5" : "w-4 h-4")}
        />
        <span className="text-foreground font-medium truncate max-w-[140px]">
          {currentLabel}
        </span>
        {known?.tier === "pro" && (
          <Crown className={cn("text-gold", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
        )}
        {isCustom && (
          <span className="hidden sm:inline text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
            Custom
          </span>
        )}
        <ChevronDown
          className={cn(
            "text-muted transition-transform",
            compact ? "w-3.5 h-3.5" : "w-4 h-4",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 sm:left-auto sm:right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] sm:w-80 rounded-2xl border border-border bg-surface/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/40 max-h-[70vh] overflow-y-auto scroll-soft"
        >
          {MODELS.map((m) => {
            const active = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => pick(m.id)}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2.5 transition-colors flex items-start gap-3",
                  active ? "bg-accent/10" : "hover:bg-white/5",
                )}
              >
                <div className="mt-0.5">
                  {active ? (
                    <Check className="w-4 h-4 text-accent-strong" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-foreground truncate">
                      {m.label}
                    </div>
                    {m.tier === "pro" && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                        Pro
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{m.tagline}</div>
                  <div className="text-[10px] text-subtle mt-1 font-mono truncate">
                    {m.id}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Custom OpenRouter model input */}
          <div className="mt-1 border-t border-border pt-2 px-2 pb-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-subtle mb-1.5">
              <Wand2 className="w-3 h-3" />
              Use any OpenRouter model
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustom();
                  }
                }}
                placeholder="kwaipilot/kat-coder-pro-v2"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 min-w-0 rounded-md bg-elevated border border-border px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/60"
              />
              <button
                type="button"
                onClick={applyCustom}
                disabled={customInput.trim().length < 3}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-accent text-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                Use
              </button>
            </div>
            {isCustom && (
              <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-accent/10 border border-accent/30">
                <Sparkles className="w-3 h-3 text-accent shrink-0" />
                <span className="text-[11px] font-mono text-accent-strong truncate flex-1">
                  {value}
                </span>
                <button
                  type="button"
                  onClick={() => pick(MODELS[0].id)}
                  aria-label="Reset to default model"
                  className="text-muted hover:text-foreground p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="text-[10px] text-subtle mt-1.5">
              Find IDs at{" "}
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                openrouter.ai/models
              </a>
              .
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
