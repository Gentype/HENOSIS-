"use client";

import Link from "next/link";
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
}: MenuBarProps) {
  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-md flex items-center px-3 gap-2 shrink-0">
      <Link
        href="/projects"
        className="p-2 -ml-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
        aria-label="Back to projects"
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>

      <Link href="/" className="hidden sm:flex">
        <Logo size="sm" />
      </Link>

      <div className="hidden md:block h-5 w-px bg-border mx-1" />

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-foreground font-medium truncate max-w-[260px]">
          {projectTitle}
        </span>
        <StatusPill status={status} />
      </div>

      {/* Center segmented preview/code toggle */}
      <div className="mx-auto rounded-full border border-border bg-surface p-0.5 flex items-center">
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

      <div className="flex items-center gap-1.5">
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
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border bg-surface hover:bg-elevated transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
        <button
          type="button"
          onClick={onShare}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border bg-surface hover:bg-elevated transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-accent text-black font-medium hover:brightness-110 transition-all shadow-[0_0_24px_-8px_rgba(184,227,201,0.7)]"
        >
          <Globe2 className="w-3.5 h-3.5" />
          Publish
        </button>
      </div>
    </header>
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
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
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
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent">
        <Loader2 className="w-3 h-3 animate-spin" />
        Generating
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent">
      <Play className="w-3 h-3" />
      Live
    </span>
  );
}
