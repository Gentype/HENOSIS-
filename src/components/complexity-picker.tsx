"use client";

import { useEffect, useRef, useState } from "react";
import { Gauge, Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPLEXITY_TIERS, scoreToTier } from "@/lib/complexity";
import type { ComplexityChoice } from "@/lib/store";

interface ComplexityPickerProps {
  value: ComplexityChoice;
  onChange: (v: ComplexityChoice) => void;
  /** When false the picker shows a lock + locks user into "Auto". */
  enabled: boolean;
  /** Smaller chip variant for the follow-up box. */
  compact?: boolean;
}

const SCORES: (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
];

/**
 * Premium-tier feature: pick the complexity manually (1–10) instead of
 * letting the AI choose. Free users see the chip with a lock icon and a
 * tooltip explaining it's a Silver+ feature; clicking it does nothing.
 */
export function ComplexityPicker({
  value,
  onChange,
  enabled,
  compact = false,
}: ComplexityPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = value === "auto" ? "Auto" : `${value}`;
  const subLabel =
    value === "auto"
      ? "AI picks"
      : COMPLEXITY_TIERS[scoreToTier(value)].label;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!enabled) return;
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={
          enabled
            ? "Choose how complex the build should be"
            : "Manual complexity is a Silver+ feature — currently set to Auto"
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border bg-surface/80 backdrop-blur transition-all",
          enabled
            ? "border-border hover:border-accent/40 hover:bg-surface text-foreground cursor-pointer"
            : "border-border/60 text-subtle cursor-not-allowed",
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs",
        )}
      >
        {enabled ? (
          <Gauge className="w-3.5 h-3.5 text-accent" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">
          Complexity: <span className="font-semibold">{label}</span>
          {value !== "auto" && enabled && (
            <span className="ml-1 text-subtle">· {subLabel}</span>
          )}
        </span>
        <span className="sm:hidden font-semibold">{label}</span>
      </button>

      {open && enabled && (
        <div
          role="listbox"
          aria-label="Complexity"
          className={cn(
            "absolute z-30 mt-2 left-0 min-w-[260px] rounded-2xl border border-border bg-surface/95 backdrop-blur-md shadow-2xl shadow-black/40",
            "p-2",
          )}
        >
          <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-wider text-subtle">
            Build complexity
          </div>
          <Row
            label="Auto"
            sub="Let the AI score it (default)"
            selected={value === "auto"}
            onClick={() => {
              onChange("auto");
              setOpen(false);
            }}
          />
          <div className="my-1.5 h-px bg-border" />
          {SCORES.map((s) => {
            const t = scoreToTier(s);
            return (
              <Row
                key={s}
                label={`${s}/10`}
                sub={COMPLEXITY_TIERS[t].description}
                selected={value === s}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors",
        selected
          ? "bg-accent/10 text-foreground"
          : "hover:bg-elevated text-foreground",
      )}
    >
      <span
        className={cn(
          "shrink-0 w-5 h-5 rounded-md grid place-items-center text-[11px] font-semibold",
          selected
            ? "bg-accent text-black"
            : "bg-elevated text-subtle",
        )}
      >
        {selected ? <Check className="w-3 h-3" /> : null}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-subtle truncate">{sub}</span>
      </span>
    </button>
  );
}
