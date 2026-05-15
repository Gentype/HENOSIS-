"use client";

import { useMemo, useRef, useState } from "react";
import type { GenerateResult } from "@/lib/types";
import { Loader2, Monitor, Smartphone, Tablet, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewPaneProps {
  result: GenerateResult | null;
  generating: boolean;
  partialContent?: string;
}

type Device = "desktop" | "tablet" | "mobile";

const WIDTHS: Record<Device, number> = {
  desktop: 1280,
  tablet: 820,
  mobile: 390,
};

export function PreviewPane({ result, generating, partialContent }: PreviewPaneProps) {
  const [device, setDevice] = useState<Device>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => {
    if (!result) return null;
    const entry = result.files.find((f) => f.path === "index.html");
    return entry?.content ?? null;
  }, [result]);

  function openInNewTab() {
    if (!srcDoc) return;
    const blob = new Blob([srcDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 px-3 border-b border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400/70" />
            <span className="w-2 h-2 rounded-full bg-amber-400/70" />
            <span className="w-2 h-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-foreground">
            {result?.meta?.title ?? "preview"}.henosis.app
          </span>
        </div>
        <div className="flex items-center gap-1">
          <DeviceBtn device="desktop" current={device} onClick={setDevice} icon={Monitor} />
          <DeviceBtn device="tablet" current={device} onClick={setDevice} icon={Tablet} />
          <DeviceBtn device="mobile" current={device} onClick={setDevice} icon={Smartphone} />
          <div className="h-4 w-px bg-border mx-1" />
          <button
            type="button"
            onClick={openInNewTab}
            disabled={!srcDoc}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open</span>
          </button>
        </div>
      </div>
      <div className="relative flex-1 bg-black overflow-auto scroll-soft grid place-items-start justify-center p-4">
        {srcDoc ? (
          <div
            className="bg-white shadow-2xl shadow-black/60 rounded-lg overflow-hidden mx-auto transition-all"
            style={{
              width: `${WIDTHS[device]}px`,
              maxWidth: "100%",
              height: device === "desktop" ? "100%" : `${Math.round(WIDTHS[device] * 1.4)}px`,
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              title="Henosis preview"
              className="w-full h-full"
              sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            />
          </div>
        ) : (
          <GeneratingState generating={generating} partial={partialContent} />
        )}
      </div>
    </div>
  );
}

function DeviceBtn({
  device,
  current,
  onClick,
  icon: Icon,
}: {
  device: Device;
  current: Device;
  onClick: (d: Device) => void;
  icon: React.ElementType;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(device)}
      title={device}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        current === device
          ? "bg-elevated text-foreground"
          : "text-muted hover:text-foreground hover:bg-white/5",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function GeneratingState({
  generating,
  partial,
}: {
  generating: boolean;
  partial?: string;
}) {
  return (
    <div className="w-full h-full grid place-items-center p-10">
      <div className="max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 grid place-items-center">
          <Loader2
            className={cn("w-5 h-5 text-accent", generating && "animate-spin")}
          />
        </div>
        <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          {generating ? "Compiling your site…" : "Ready when you are"}
        </h3>
        <p className="mt-2 text-sm text-muted">
          {generating
            ? "Henosis is drafting layouts, picking a palette and writing the code."
            : "Send a prompt to start generating."}
        </p>

        {generating && (
          <div className="relative mt-8 h-1 rounded-full bg-elevated overflow-hidden loading-bar">
            <div className="absolute inset-0" />
          </div>
        )}

        {generating && partial && (
          <div className="mt-8 text-left rounded-xl border border-border bg-surface p-4 max-h-64 overflow-auto scroll-soft">
            <div className="text-[10px] uppercase tracking-wider text-subtle mb-2">
              Streaming output
            </div>
            <pre className="text-[11px] font-mono text-muted whitespace-pre-wrap leading-5">
              {partial.slice(-1200)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
