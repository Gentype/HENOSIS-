"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ArrowUp, Gauge, Loader2, Lock, Sparkles, Wand2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ModelSelector } from "./model-selector";
import { useDraft, useProjects, useUser } from "@/lib/store";
import { cn } from "@/lib/utils";

interface PromptBoxProps {
  large?: boolean;
  initialPrompt?: string;
  /** When provided, submits as a follow-up message to an existing project instead of creating a new one. */
  onSubmitFollowUp?: (prompt: string) => Promise<void> | void;
  placeholder?: string;
  autoFocus?: boolean;
}

const PLACEHOLDER =
  "Describe the website you want. Be specific — sections, brand, vibe, content…";

export function PromptBox({
  large = true,
  initialPrompt,
  onSubmitFollowUp,
  placeholder = PLACEHOLDER,
  autoFocus = false,
}: PromptBoxProps) {
  const router = useRouter();
  const draftPrompt = useDraft((s) => s.prompt);
  const draftModel = useDraft((s) => s.model);
  const draftComplexity = useDraft((s) => s.complexityOverride);
  const setDraftPrompt = useDraft((s) => s.setPrompt);
  const setDraftModel = useDraft((s) => s.setModel);
  const setDraftComplexity = useDraft((s) => s.setComplexityOverride);
  const upsertProject = useProjects((s) => s.upsert);
  const setCurrentProject = useProjects((s) => s.setCurrent);
  const user = useUser((s) => s.user);
  // Silver (pro) and Gold (ultra) tiers can manually override the
  // Quality-Check score before generation. Free users get the standard
  // analyzer-driven flow.
  const canChooseComplexity = user?.plan === "pro" || user?.plan === "ultra";
  // Use the NextAuth session for the binary "is this browser signed in?"
  // check. It's SSR-resolved (see `Providers` / `initialSession`) so it's
  // already correct on the first client render — unlike `useUser.user`,
  // which only fills in after `/api/me` resolves a few hundred ms later.
  // Without this, a freshly-signed-in user clicking Generate gets bounced
  // back to /auth because `user` is still null, even though the session
  // cookie is set. That's the "registers, but the site keeps asking to
  // sign in" bug.
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const isSessionLoading = sessionStatus === "loading";

  const [value, setValue] = useState(initialPrompt ?? draftPrompt ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [improving, setImproving] = useState(false);
  const [shake, setShake] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // sync local value with the draft store so clicking an example card (which
  // calls setDraftPrompt) actually populates the textarea.
  useEffect(() => {
    // skip the follow-up box — we never want the home draft bleeding into chat
    if (onSubmitFollowUp) return;
    if (typeof draftPrompt === "string" && draftPrompt !== value) {
      setValue(draftPrompt);
      // bring textarea into view + focus so the user sees the prompt landed
      textareaRef.current?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPrompt, onSubmitFollowUp]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) textareaRef.current.focus();
  }, [autoFocus]);

  async function submit() {
    if (submitting) return;
    const prompt = value.trim();
    if (prompt.length < 5) {
      // Premium UX: instead of a dead grey button, give clear feedback.
      setShake(true);
      setTimeout(() => setShake(false), 480);
      textareaRef.current?.focus();
      return;
    }
    // Persist the draft FIRST so it survives a redirect to /auth and lands
    // back in the textarea after the user signs in.
    setDraftPrompt(prompt);

    if (onSubmitFollowUp) {
      // Follow-ups happen inside /generate, which already requires auth to
      // reach. Don't double-check here — let the API enforce.
      setSubmitting(true);
      try {
        await onSubmitFollowUp(prompt);
        setValue("");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Still resolving the SSR-provided session on the very first client
    // render — wait one tick rather than redirect prematurely, otherwise a
    // signed-in user who clicks Generate before SessionProvider hydrates
    // gets bounced to /auth → /auth bounces them back → flicker.
    if (isSessionLoading) return;

    // Anonymous users: bounce to /auth with the prompt safely stored in the
    // draft store. After sign-in, /auth redirects back to "/" and the
    // textarea is repopulated from the draft.
    if (!isAuthenticated) {
      router.push("/auth?then=generate");
      return;
    }

    setSubmitting(true);
    const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    // Manual complexity override is only honoured for paid tiers — but we
    // also clamp/clean it here so a stale free-tier draft doesn't sneak
    // through if the user downgraded.
    const override =
      canChooseComplexity && draftComplexity != null
        ? Math.max(2, Math.min(10, Math.round(draftComplexity)))
        : undefined;
    upsertProject({
      id,
      prompt,
      model: draftModel,
      status: "analyzing",
      title: shortTitle(prompt),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      result: null,
      history: [
        {
          id: `m_${Date.now()}`,
          role: "user",
          content: prompt,
          createdAt: Date.now(),
          status: "done",
        },
      ],
      complexityOverride: override,
    });
    setCurrentProject(id);

    // navigate; the /generate page picks up the project from the store and
    // automatically kicks off the Quality Check + streaming request.
    router.push(`/generate?id=${encodeURIComponent(id)}&autostart=1`);
  }

  function shortTitle(s: string): string {
    const t = s.trim().split(/\s+/).slice(0, 6).join(" ");
    return t.length > 60 ? t.slice(0, 60) + "…" : t;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function improve() {
    if (improving || submitting) return;
    const raw = value.trim();
    if (raw.length < 3) {
      setShake(true);
      setTimeout(() => setShake(false), 480);
      textareaRef.current?.focus();
      return;
    }
    setImproving(true);
    try {
      const res = await fetch("/api/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: raw, model: draftModel }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { improved: string };
      if (data?.improved) {
        const improved = data.improved.trim();
        setValue(improved);
        setDraftPrompt(improved);
      }
    } catch {
      // silent — leave the user's prompt alone
      setShake(true);
      setTimeout(() => setShake(false), 480);
    } finally {
      setImproving(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div
      className={cn(
        "relative w-full mx-auto rounded-3xl border border-border bg-surface/80 backdrop-blur-md",
        "transition-all focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_rgba(184,227,201,0.08),0_30px_80px_-30px_rgba(184,227,201,0.35)]",
        large ? "max-w-3xl p-4 sm:p-5" : "max-w-2xl p-3",
        shake && "shake-input",
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={3}
        className={cn(
          "w-full bg-transparent resize-none outline-none placeholder:text-subtle text-foreground",
          large ? "text-lg leading-relaxed min-h-[120px]" : "text-base leading-relaxed min-h-[80px]",
        )}
        disabled={submitting}
      />

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <ModelSelector value={draftModel} onChange={setDraftModel} compact={!large} />

        <button
          type="button"
          onClick={improve}
          disabled={improving || submitting}
          aria-label="Improve prompt with AI"
          title="Let the AI expand your prompt into a richer brief"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 backdrop-blur transition-all",
            "hover:border-accent/40 hover:bg-surface text-foreground",
            "disabled:opacity-60 disabled:cursor-progress",
            large ? "px-3 py-1.5 text-xs" : "px-2.5 py-1.5 text-[11px]",
          )}
        >
          {improving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
          ) : (
            <Wand2 className="w-3.5 h-3.5 text-accent" />
          )}
          <span className="hidden sm:inline">{improving ? "Improving…" : "Improve prompt"}</span>
          <span className="sm:hidden">{improving ? "…" : "Improve"}</span>
        </button>

        {/* Complexity chip — Silver/Gold get a slider, free users see a
            locked auto-detect chip pointing at /pricing. Hidden on
            follow-up edits where we inherit the project's existing tier. */}
        {!onSubmitFollowUp && (
          <ComplexityChip
            value={draftComplexity}
            onChange={setDraftComplexity}
            canChoose={canChooseComplexity}
            compact={!large}
          />
        )}

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-subtle px-2.5 py-1">
          <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
            ⌘
          </kbd>
          <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
            Enter
          </kbd>
          <span>to generate</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user && (
            <span className="text-xs text-subtle hidden sm:inline">
              {user.generationsUsed}/{user.limit == null ? "∞" : user.limit} used · {user.tier}
            </span>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={cn(
              "btn-generate inline-flex items-center gap-2 rounded-full font-semibold cursor-pointer",
              large ? "px-6 py-3 text-base" : "px-5 py-2.5 text-sm",
              "disabled:cursor-progress",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Starting…</span>
              </>
            ) : !isAuthenticated && !isSessionLoading && !onSubmitFollowUp ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Sign in to generate</span>
                <ArrowUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate</span>
                <ArrowUp className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComplexityChip — Silver/Gold-tier complexity override.
//
// Silver / Gold users see a pill with the current value (or "Auto") and a
// slider popover (2–10) to pick the target complexity for the Site
// Architect. Free users see the same pill but locked, with a tooltip
// directing them to /pricing — they get the analyzer-driven flow instead.
// ---------------------------------------------------------------------------
interface ComplexityChipProps {
  value: number | null;
  onChange: (next: number | null) => void;
  canChoose: boolean;
  compact?: boolean;
}

function ComplexityChip({
  value,
  onChange,
  canChoose,
  compact,
}: ComplexityChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!canChoose) {
    return (
      <Link
        href="/pricing"
        title="Upgrade to Silver to manually pick a complexity score."
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 text-subtle backdrop-blur",
          "hover:border-accent/30 hover:text-foreground transition-all",
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs",
        )}
      >
        <Lock className="w-3.5 h-3.5" />
        <span>Auto · ?/10</span>
      </Link>
    );
  }

  const label = value == null ? "Auto · ?/10" : `${value}/10`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Set target complexity for this generation"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 backdrop-blur transition-all",
          "hover:border-accent/40 hover:bg-surface text-foreground",
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs",
          value != null && "border-accent/40",
        )}
      >
        <Gauge className="w-3.5 h-3.5 text-accent" />
        <span className="hidden sm:inline">Complexity</span>
        <span className="font-mono tabular-nums">{label}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Complexity selector"
          className={cn(
            "absolute z-30 mt-2 left-0 w-72 rounded-2xl border border-border bg-surface/95 backdrop-blur-md shadow-2xl shadow-black/40 p-4",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-foreground text-sm font-medium">
              <Gauge className="w-3.5 h-3.5 text-accent" />
              <span>Target complexity</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(null);
              }}
              className={cn(
                "text-[11px] uppercase tracking-wider px-2 py-1 rounded-md border border-border text-subtle",
                "hover:border-accent/40 hover:text-foreground transition-all",
                value == null && "border-accent/40 text-accent",
              )}
            >
              Auto
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Pick how hard the AI should push. Silver+ feature — overrides the
            Quality Check classifier.
          </p>

          <input
            type="range"
            min={2}
            max={10}
            step={1}
            value={value ?? 5}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="mt-4 w-full accent-[color:var(--color-accent,#b8e3c9)]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-subtle font-mono tabular-nums">
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
            <span>6</span>
            <span>7</span>
            <span>8</span>
            <span>9</span>
            <span>10</span>
          </div>

          <div className="mt-3 text-xs text-foreground/90">
            <span className="font-mono tabular-nums text-base">
              {value ?? "—"}
              <span className="text-subtle">/10</span>
            </span>{" "}
            <span className="text-muted">
              {value == null
                ? "Auto-detect via Quality Check."
                : complexityHint(value)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function complexityHint(score: number): string {
  if (score <= 3) return "Simple landing — html only.";
  if (score === 4) return "Content landing — html only.";
  if (score === 5) return "Animated single-page — js-modules.";
  if (score === 6) return "Two-page site — js-modules.";
  if (score === 7) return "Multi-page clone — typescript project.";
  if (score === 8) return "Full product — typescript project.";
  if (score === 9) return "Production SaaS — typescript project.";
  return "Custom system — typescript project.";
}
