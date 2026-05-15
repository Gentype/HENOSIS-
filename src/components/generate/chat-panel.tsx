"use client";

import { Fragment, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import {
  Loader2,
  Sparkles,
  User2,
  AlertCircle,
  Wand2,
  FileCode2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PromptBox } from "@/components/prompt-box";

interface ChatPanelProps {
  messages: ChatMessage[];
  generating: boolean;
  onFollowUp: (prompt: string) => Promise<void>;
}

export function ChatPanel({ messages, generating, onFollowUp }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, generating]);

  return (
    <aside
      className={cn(
        "h-full flex flex-col border-r border-border bg-surface md:bg-surface/40 shadow-2xl shadow-black/40 md:shadow-none",
        generating && "ring-glow",
      )}
    >
      <div className="h-11 px-4 border-b border-border flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Wand2 className="w-4 h-4 text-accent" />
          <span className="font-medium">Henosis Chat</span>
        </div>
        <span className="text-xs text-subtle">{messages.length} messages</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-soft p-4 space-y-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {generating && <ThinkingBubble />}
      </div>

      <div className="p-3 border-t border-border bg-surface/80">
        <FollowUpInput onSubmit={onFollowUp} disabled={generating} />
      </div>
    </aside>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";

  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold",
          isUser
            ? "bg-foreground/10 text-foreground"
            : "bg-accent text-black",
          isStreaming && "chat-avatar-pulse",
        )}
      >
        {isUser ? (
          <User2 className="w-3.5 h-3.5" />
        ) : (
          <Sparkles
            className={cn(
              "w-3.5 h-3.5",
              isStreaming && "animate-spin",
            )}
          />
        )}
      </div>
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed",
          isUser
            ? "bg-foreground/5 text-foreground rounded-tr-sm"
            : isError
              ? "bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-sm"
              : isStreaming
                ? "bg-elevated/60 border border-accent/30 text-foreground rounded-tl-sm"
                : "bg-elevated text-foreground rounded-tl-sm border border-border",
        )}
      >
        {isError && (
          <div className="flex items-center gap-1.5 text-red-300 mb-1.5 text-xs uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5" /> Error
          </div>
        )}
        <RichContent content={message.content} streaming={isStreaming} />
      </div>
    </div>
  );
}

// Renders chat content with `backticked` segments rendered as soft file chips.
function RichContent({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  const parts = content.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          const path = part.slice(1, -1);
          return (
            <span
              key={i}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md",
                "bg-accent/10 border border-accent/25 text-accent-strong",
                "font-mono text-[12px] align-baseline",
                streaming && "chip-pulse",
              )}
            >
              <FileCode2 className="w-3 h-3" />
              {path}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
      {streaming && (
        <span className="inline-block align-middle ml-1 w-1.5 h-3.5 bg-accent/70 rounded-sm caret-blink" />
      )}
    </>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2.5">
      <div className="shrink-0 w-7 h-7 rounded-full grid place-items-center bg-accent text-black">
        <Sparkles className="w-3.5 h-3.5" />
      </div>
      <div className="rounded-2xl px-3.5 py-2.5 text-sm bg-elevated border border-border rounded-tl-sm inline-flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
        <span className="text-muted">Designing your site…</span>
      </div>
    </div>
  );
}

function FollowUpInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (prompt: string) => Promise<void>;
  disabled: boolean;
}) {
  return (
    <div className={disabled ? "pointer-events-none opacity-60" : undefined}>
      <PromptBox
        large={false}
        placeholder={
          disabled
            ? "Wait for the current generation to finish…"
            : "Ask for changes — e.g. 'make the hero darker, add a pricing section'"
        }
        onSubmitFollowUp={onSubmit}
        autoFocus={false}
      />
    </div>
  );
}
