"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { ModelSelector } from "@/components/model-selector";
import {
  ArrowLeft,
  Code2,
  Download,
  Eye,
  Loader2,
  Play,
  Share2,
  Globe2,
  RefreshCcw,
  MoreHorizontal,
  MessageSquareText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuBarProps {
  projectTitle: string;
  status: "generating" | "done" | "error";
  view: "preview" | "code";
  onViewChange: (v: "preview" | "code") => void;
  model: string;
  onModelChange: (m: string) => void;
  onDownload?: () => void;
  onShare?: () => void;
  onRefresh?: () => void;
  onPublish?: () => void;
  /** Toggle the left chat panel on mobile. */
  onToggleChat?: () => void;
  chatOpen?: boolean;
}

export function MenuBar({
  projectTitle,
  status,
  view,
  onViewChange,
  model,
  onModelChange,
  onDownload,
  onShare,
  onRefresh,
  onPublish,
  onToggleChat,
  chatOpen,
}: MenuBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // close "More" menu on outside click / escape
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <header className="relative z-50 h-14 border-b border-border bg-surface/80 backdrop-blur-md flex items-center px-2 sm:px-3 gap-1.5 sm:gap-2 shrink-0">
      {/* Mobile chat toggle */}
      {onToggleChat && (
        <button
          type="button"
          onClick={onToggleChat}
          aria-label={chatOpen ? "Close chat" : "Open chat"}
          aria-pressed={chatOpen}
          className={cn(
            "md:hidden p-2 -ml-1 rounded-md transition-colors",
            chatOpen
              ? "text-accent bg-accent/10"
              : "text-muted hover:text-foreground hover:bg-white/5",
          )}
        >
          <MessageSquareText className="w-4 h-4" />
        </button>
      )}

      <Link
        href="/projects"
        className="hidden md:inline-flex p-2 -ml-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
        aria-label="Back to projects"
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>

      <Link href="/" className="hidden lg:flex">
        <Logo size="sm" />
      </Link>

      <div className="hidden lg:block h-5 w-px bg-border mx-1" />

      <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial">
        <span className="text-sm text-foreground font-medium truncate max-w-[160px] sm:max-w-[260px]">
          {projectTitle}
        </span>
        <StatusPill status={status} />
      </div>

      {/* Center segmented preview/code toggle */}
      <div className="md:mx-auto rounded-full border border-border bg-surface p-0.5 flex items-center shrink-0">
        <SegBtn
          active={view === "preview"}
          onClick={() => onViewChange("preview")}
          icon={Eye}
        >
          Preview
        </SegBtn>
        <SegBtn
          active={view === "code"}
          onClick={() => onViewChange("code")}
          icon={Code2}
        >
          Code
        </SegBtn>
      </div>

      {/* Desktop action cluster */}
      <div className="hidden md:flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh preview"
          className="p-2 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
        <ModelSelector value={model} onChange={onModelChange} compact />
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border bg-surface hover:bg-elevated transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border bg-surface hover:bg-elevated transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
        <button
          type="button"
          onClick={onPublish}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-accent text-black font-medium hover:brightness-110 transition-all shadow-[0_0_24px_-8px_rgba(184,227,201,0.7)]"
        >
          <Globe2 className="w-3.5 h-3.5" />
          Publish
        </button>
      </div>

      {/* Mobile collapsed action menu */}
      <div className="md:hidden relative" ref={moreRef}>
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-label="More actions"
          aria-expanded={moreOpen}
          className="p-2 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        {moreOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/60 z-50">
            <MobileItem
              icon={RefreshCcw}
              label="Refresh preview"
              onClick={() => {
                onRefresh?.();
                setMoreOpen(false);
              }}
            />
            <MobileItem
              icon={Download}
              label="Export"
              onClick={() => {
                onDownload?.();
                setMoreOpen(false);
              }}
            />
            <MobileItem
              icon={Share2}
              label="Share link"
              onClick={() => {
                onShare?.();
                setMoreOpen(false);
              }}
            />
            <div className="my-1 h-px bg-border" />
            <MobileItem
              icon={Globe2}
              label="Publish"
              accent
              onClick={() => {
                onPublish?.();
                setMoreOpen(false);
              }}
            />
            <div className="my-1 h-px bg-border" />
            <Link
              href="/projects"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to projects
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function MobileItem({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors",
        accent
          ? "text-accent-strong hover:bg-accent/10 font-medium"
          : "text-foreground hover:bg-white/5",
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function SegBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors",
        active
          ? "bg-elevated text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          : "text-muted hover:text-foreground",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{children}</span>
    </button>
  );
}

function StatusPill({ status }: { status: "generating" | "done" | "error" }) {
  if (status === "generating") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent shrink-0">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="hidden sm:inline">Generating</span>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 shrink-0">
        <span className="hidden sm:inline">Failed</span>
        <span className="sm:hidden">!</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent shrink-0">
      <Play className="w-3 h-3" />
      <span className="hidden sm:inline">Live</span>
    </span>
  );
}
