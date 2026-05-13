"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, Crown } from "lucide-react";
import { MODELS } from "@/lib/examples";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}

export function ModelSelector({ value, onChange, compact = false }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 backdrop-blur",
          "hover:bg-surface hover:border-border-strong transition-all",
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        )}
      >
        <Sparkles
          className={cn("text-accent", compact ? "w-3.5 h-3.5" : "w-4 h-4")}
        />
        <span className="text-foreground font-medium">{current.label}</span>
        {current.tier === "pro" && (
          <Crown className={cn("text-gold", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
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
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-border bg-surface/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/40">
          {MODELS.map((m) => {
            const active = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2.5 transition-colors flex items-start gap-3",
                  active ? "bg-accent/10" : "hover:bg-white/5",
                )}
              >
                <div className="mt-0.5">
                  <Sparkles
                    className={cn(
                      "w-4 h-4",
                      active ? "text-accent-strong" : "text-muted",
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-foreground">
                      {m.label}
                    </div>
                    {m.tier === "pro" && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                        Pro
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{m.tagline}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
