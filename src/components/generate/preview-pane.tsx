"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GenerateResult, GenerateResultFile } from "@/lib/types";
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Home,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { assemblePreview, hasReactEntry } from "@/lib/preview-assembler";
import { LiveBuilder } from "./live-builder";
import { OrbitalLoader } from "./loader";

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

/**
 * Live preview of the generated site.
 *
 * Architecture (post-rewrite):
 *
 *   The iframe sandbox is `allow-scripts allow-same-origin allow-forms` —
 *   note the deliberate omission of `allow-popups` and `allow-top-
 *   navigation`. Combined with the navigation interceptor injected into
 *   every preview document (see lib/scaffold/nav-interceptor.ts), this
 *   means:
 *
 *     • The iframe physically cannot navigate the parent Henosis page.
 *     • The iframe physically cannot open new tabs/windows.
 *     • Every click on an `<a>` posts a `henosis-{nav,external}` message
 *       to us, and WE decide whether to swap the active route (HTML
 *       mode) or open the URL via `window.open` with `noopener,
 *       noreferrer` (external).
 *
 *   That kills three bugs the user hit on the old build:
 *     1. Clicking a link inside the generated site refreshed the
 *        Henosis workshop page itself.
 *     2. Refreshing the workshop a few times spawned duplicate tabs.
 *     3. The preview occasionally went blank because a `<form>` inside
 *        the AI site auto-submitted to a missing endpoint.
 *
 *   For HTML mode we additionally rewrite the file set so the user's
 *   currently-selected page is mounted as `index.html`, then assemble.
 *   When the route doesn't resolve to any file, we render a styled 404.
 *
 *   For React mode we hand the result to {@link assemblePreview}
 *   verbatim — routing is the App's responsibility.
 */
export function PreviewPane({ result, generating, partialContent }: PreviewPaneProps) {
  const [device, setDevice] = useState<Device>("desktop");
  const [route, setRoute] = useState<string>("index.html");
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Blob URLs allocated by `openInNewTab` — tracked so we can revoke them
  // on unmount, preventing the slow memory creep that made the workshop
  // feel laggy after a dozen refreshes.
  const blobUrlsRef = useRef<string[]>([]);

  // Boot watchdog state. The iframe injects nav-interceptor.ts which posts
  // `henosis-ready` once it has wired up listeners + wrapped console, then
  // sends a `henosis-heartbeat` every second. If neither arrives within
  // 10s of the srcDoc mounting, something prevented the iframe's scripts
  // from running — bad srcDoc, CSP, blocked CDN — and the user deserves
  // to see WHY rather than staring at a blank pane wondering which of
  // the 12 emitted files isn't connected to the preview.
  const [bootedAt, setBootedAt] = useState<number | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<
    Array<{ level: string; message: string; t: number }>
  >([]);
  const [showConsole, setShowConsole] = useState(false);

  // Toast queue. Used today to surface "this link doesn't work in preview"
  // when a React-mode iframe posts henosis-nav for an internal link the
  // SPA has no route for. Toasts auto-dismiss after a few seconds.
  const [toasts, setToasts] = useState<
    Array<{ id: number; tone: "info" | "warn" | "error"; message: string }>
  >([]);
  const toastIdRef = useRef(0);
  const pushToast = useCallback(
    (tone: "info" | "warn" | "error", message: string) => {
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, tone, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    [],
  );

  const isReact = useMemo(
    () => (result ? hasReactEntry(result.files) : false),
    [result],
  );

  // Reset route + runtime error when the project changes
  useEffect(() => {
    setRoute("index.html");
    setRuntimeError(null);
    setBootedAt(null);
    setLastHeartbeat(null);
    setBootTimedOut(false);
    setConsoleMessages([]);
    setToasts([]);
  }, [result]);

  // Reset boot watchdog state when the user clicks "Reload" — same logic
  // as a fresh result, just keyed off the reload counter.
  useEffect(() => {
    if (reloadKey === 0) return;
    setBootedAt(null);
    setLastHeartbeat(null);
    setBootTimedOut(false);
    setConsoleMessages([]);
  }, [reloadKey]);

  // ─── iframe URL resolver (HTML mode) ──────────────────────────────
  const resolveHref = useCallback(
    (href: string): { matched: GenerateResultFile | null; cleanRoute: string } => {
      if (!result) return { matched: null, cleanRoute: href };
      const stripped = href.split("#")[0].split("?")[0];
      const trimmed = stripped.replace(/^\.?\//, "").replace(/\/$/, "");
      const candidates: string[] = [];

      if (
        !trimmed ||
        trimmed.toLowerCase() === "index" ||
        trimmed === "/" ||
        trimmed.toLowerCase() === "index.html"
      ) {
        candidates.push("index.html");
      } else {
        candidates.push(trimmed);
        if (!trimmed.toLowerCase().endsWith(".html")) {
          candidates.push(`${trimmed}.html`);
          candidates.push(`pages/${trimmed}.html`);
          candidates.push(`pages/${trimmed}/index.html`);
        } else if (!trimmed.toLowerCase().startsWith("pages/")) {
          candidates.push(`pages/${trimmed}`);
        }
      }

      for (const cand of candidates) {
        const lower = cand.toLowerCase();
        const found = result.files.find((f) => f.path.toLowerCase() === lower);
        if (found) return { matched: found, cleanRoute: found.path };
      }
      return { matched: null, cleanRoute: trimmed || "index.html" };
    },
    [result],
  );

  // ─── srcDoc assembly ──────────────────────────────────────────────
  const srcDoc = useMemo(() => {
    if (!result) return null;
    if (isReact) return assemblePreview(result);

    const { matched } = resolveHref(route);
    if (!matched) return build404SrcDoc(route, result);

    const rerooted: GenerateResult = {
      ...result,
      files: result.files
        .filter((f) => f.path !== "index.html" || matched.path === "index.html")
        .map((f) => (f.path === matched.path ? { ...f, path: "index.html" } : f)),
    };
    return assemblePreview(rerooted);
    // reloadKey is a deliberate dep — bumping it forces the iframe to
    // re-evaluate srcDoc and so reload from scratch even when the result
    // hasn't changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, route, resolveHref, isReact, reloadKey]);

  // ─── Boot watchdog ────────────────────────────────────────────────
  // Starts when there's a srcDoc but no boot signal yet. Fires after 10s
  // and flips the diagnostic banner on. The user can still click "Reload"
  // to retry. This is what makes "the preview is empty / didn't show
  // anything" debuggable instead of guesswork.
  useEffect(() => {
    if (!srcDoc || bootedAt) return;
    const timer = window.setTimeout(() => {
      setBootTimedOut(true);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [srcDoc, bootedAt, reloadKey]);

  // ─── Listen for messages from the iframe nav interceptor ──────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== "object") return;
      const data = e.data as {
        type?: string;
        href?: string;
        message?: string;
        level?: string;
        t?: number;
      };

      switch (data.type) {
        case "henosis-nav": {
          const href = data.href ?? "";
          if (!href) return;
          if (isReact) {
            // React-mode SPAs own their own routing. The interceptor
            // only posts henosis-nav after it FAILED to resolve the
            // href to an in-iframe element id (see nav-interceptor.ts
            // local-scroll fallback). That means the AI emitted a dead
            // link — typically <a href="/menu"> when it should have
            // been <button onClick={() => setView('menu')}>. Surface
            // a toast so the user knows the click registered but the
            // generated SPA has no route for it.
            const display = href.length > 32 ? href.slice(0, 31) + "…" : href;
            pushToast(
              "warn",
              "Dead link in preview: " +
                display +
                " — the AI used <a href> for SPA navigation. Use the Code tab to inspect.",
            );
            return;
          }
          const { cleanRoute } = resolveHref(href);
          setRoute(cleanRoute);
          return;
        }
        case "henosis-external": {
          // The iframe sandbox doesn't allow popups, so it asks us to
          // open external links. `noopener,noreferrer` keeps the user
          // safe from the opened tab back-channelling.
          const href = data.href ?? "";
          if (!href) return;
          try {
            window.open(href, "_blank", "noopener,noreferrer");
          } catch {
            /* ignore — pop-up blocker swallowed it */
          }
          return;
        }
        case "henosis-runtime-error": {
          // Kept silent in the URL bar for minor errors; the iframe's
          // own error overlay handles the dramatic UI. We just light
          // up the small badge in the chrome and pin the message into
          // the console panel for diagnosis.
          if (typeof data.message === "string" && data.message) {
            setRuntimeError(data.message);
            setConsoleMessages((m) =>
              [
                ...m,
                { level: "error", message: data.message ?? "", t: Date.now() },
              ].slice(-50),
            );
          }
          return;
        }
        case "henosis-ready": {
          // The iframe's nav-interceptor finished installing — scripts
          // are running, console is wired, listeners are mounted. From
          // here the watchdog is satisfied; if React still doesn't
          // commit, the runtime error overlay handles it.
          setBootedAt(Date.now());
          setBootTimedOut(false);
          setLastHeartbeat(Date.now());
          return;
        }
        case "henosis-heartbeat": {
          // 1Hz keep-alive from the iframe. Useful for "iframe loaded
          // but is it actually alive?" diagnostics.
          setLastHeartbeat(typeof data.t === "number" ? data.t : Date.now());
          return;
        }
        case "henosis-console": {
          // console.log/.warn/.error/.info from inside the iframe. We
          // surface these in a collapsible console panel so the user
          // can see what the AI's site is logging without opening
          // browser devtools on the iframe.
          if (typeof data.message !== "string") return;
          setConsoleMessages((m) =>
            [
              ...m,
              {
                level: typeof data.level === "string" ? data.level : "log",
                message: data.message ?? "",
                t: Date.now(),
              },
            ].slice(-50),
          );
          return;
        }
        default:
          return;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resolveHref, isReact, pushToast]);

  // ─── Cleanup blob URLs on unmount ─────────────────────────────────
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      for (const u of urls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      }
      urls.length = 0;
    };
  }, []);

  function openInNewTab() {
    if (!srcDoc) return;
    const blob = new Blob([srcDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.push(url);
    // Revoke after a generous window so the spawned tab has time to
    // finish parsing the document. 60s is plenty.
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== url);
    }, 60_000);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function reloadIframe() {
    setRuntimeError(null);
    setReloadKey((k) => k + 1);
  }

  const isHome = route === "index.html";
  const showHomeChip = !isReact && !isHome;

  return (
    <div className="h-full flex flex-col">
      <div className="relative h-9 px-3 border-b border-border flex items-center justify-between text-xs gap-3">
        {/* Animated gradient line under the chrome bar — sweeps while
            generation is in flight (Chrome DevTools network-bar style). */}
        {generating && (
          <span aria-hidden className="chrome-line absolute -bottom-px" />
        )}
        <div className="flex items-center gap-2 text-muted min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              generating && "tl-pulse",
            )}
          >
            <span className="w-2 h-2 rounded-full bg-red-400/70" />
            <span className="w-2 h-2 rounded-full bg-amber-400/70" />
            <span className="w-2 h-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-foreground truncate">
            {result?.meta?.title ?? "preview"}.henosis.app
            {showHomeChip && (
              <span className="text-subtle">/{routeDisplay(route)}</span>
            )}
          </span>
          {showHomeChip && (
            <button
              type="button"
              onClick={() => setRoute("index.html")}
              title="Back to home"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-subtle hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <Home className="w-3 h-3" />
              <span>home</span>
            </button>
          )}
          {runtimeError && (
            <span
              title={runtimeError}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-[10px] uppercase tracking-wider"
            >
              <AlertCircle className="w-2.5 h-2.5" /> error
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DeviceBtn device="desktop" current={device} onClick={setDevice} icon={Monitor} />
          <DeviceBtn device="tablet" current={device} onClick={setDevice} icon={Tablet} />
          <DeviceBtn device="mobile" current={device} onClick={setDevice} icon={Smartphone} />
          <div className="h-4 w-px bg-border mx-1" />
          <button
            type="button"
            onClick={reloadIframe}
            disabled={!srcDoc}
            title="Reload the preview iframe"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            type="button"
            onClick={() => setShowConsole((v) => !v)}
            title="Show iframe console messages"
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors relative",
              showConsole && "bg-white/5 text-foreground",
              consoleMessages.some((m) => m.level === "error") &&
                "text-red-300 hover:text-red-200",
            )}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Console</span>
            {consoleMessages.length > 0 && (
              <span
                className={cn(
                  "absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-semibold grid place-items-center",
                  consoleMessages.some((m) => m.level === "error")
                    ? "bg-red-500/80 text-white"
                    : "bg-accent/80 text-black",
                )}
              >
                {consoleMessages.length > 99 ? "99+" : consoleMessages.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={openInNewTab}
            disabled={!srcDoc}
            title="Open this preview in a new browser tab"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open</span>
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
              height:
                device === "desktop"
                  ? "100%"
                  : `${Math.round(WIDTHS[device] * 1.4)}px`,
            }}
          >
            <iframe
              key={reloadKey}
              ref={iframeRef}
              srcDoc={srcDoc}
              title="Henosis preview"
              className="w-full h-full"
              // No `allow-popups` (the iframe asks us to open links via
              // postMessage) and no `allow-top-navigation` (so the
              // preview can never replace the workshop tab).
              sandbox="allow-scripts allow-same-origin allow-forms"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </div>
        ) : (
          <GeneratingState generating={generating} partial={partialContent} />
        )}

        {/* Diagnostic banner — surfaces when the iframe failed to boot
            within 10s. Without this, the user just sees a blank white
            rectangle and concludes "the AI is broken". */}
        {srcDoc && bootTimedOut && !bootedAt && (
          <DiagnosticBanner
            result={result}
            isReact={isReact}
            runtimeError={runtimeError}
            onReload={reloadIframe}
            onOpenConsole={() => setShowConsole(true)}
          />
        )}

        {/* Iframe console panel — slides up from the bottom when the user
            clicks the Console button or when the boot watchdog fires.
            Shows whatever the AI's site logged via console.log/.warn/
            .error/.info, plus any unhandled errors. */}
        {srcDoc && showConsole && (
          <ConsolePanel
            messages={consoleMessages}
            onClose={() => setShowConsole(false)}
            onClear={() => setConsoleMessages([])}
          />
        )}

        {/* Toast stack — top-right of the preview area. Used to surface
            "this link doesn't work in preview" when the React-mode iframe
            posts henosis-nav for a dead link. Auto-dismisses on its own. */}
        {toasts.length > 0 && (
          <ToastStack
            toasts={toasts}
            onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
          />
        )}
      </div>
    </div>
  );
}

function routeDisplay(route: string): string {
  return route.replace(/^pages\//, "").replace(/\.html$/, "");
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
  if (generating) {
    return (
      <div className="w-full h-full grid place-items-center p-6 sm:p-10">
        <LiveBuilder partial={partial ?? ""} />
      </div>
    );
  }
  return (
    <div className="w-full h-full grid place-items-center p-10">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 grid place-items-center">
          <OrbitalLoader size={28} label="Idle" />
        </div>
        <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          Ready when you are
        </h3>
        <p className="mt-2 text-sm text-muted">Send a prompt to start generating.</p>
      </div>
    </div>
  );
}

/**
 * Diagnostic banner — pinned to the top of the preview area when the
 * boot watchdog times out (10s without a `henosis-ready` from the
 * iframe). Tells the user exactly what files were generated, what the
 * runtime tried, and the last runtime error if any. This is the
 * difference between "the preview is empty so the AI is shit" and
 * "ah, the preview's React entry couldn't find App.tsx — let me regen".
 */
function DiagnosticBanner({
  result,
  isReact,
  runtimeError,
  onReload,
  onOpenConsole,
}: {
  result: GenerateResult | null;
  isReact: boolean;
  runtimeError: string | null;
  onReload: () => void;
  onOpenConsole: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fileCount = result?.files.length ?? 0;
  const fileList = result?.files.map((f) => f.path) ?? [];

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-xl w-[calc(100%-32px)]">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur-md shadow-2xl shadow-black/60">
        <div className="px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-amber-100">
              Preview didn't boot in 10 seconds
            </div>
            <div className="mt-1 text-xs text-amber-200/80 leading-relaxed">
              The AI generated <strong>{fileCount} file{fileCount === 1 ? "" : "s"}</strong>{" "}
              ({isReact ? "React + TypeScript" : "HTML"} mode), but the iframe never reported back.{" "}
              The most common causes are a Babel/Tailwind CDN block, a syntax error in the
              entry, or AI-emitted paths that don't match what the runtime expects.
            </div>
            {runtimeError && (
              <div className="mt-2 text-[11px] font-mono text-red-200 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1.5 break-all">
                <span className="opacity-60 uppercase tracking-wider mr-1">Error:</span>
                {runtimeError}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onReload}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-amber-300 text-black hover:bg-amber-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Reload preview
              </button>
              <button
                type="button"
                onClick={onOpenConsole}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-md border border-amber-500/40 text-amber-100 hover:bg-amber-500/20 transition-colors"
              >
                <Terminal className="w-3 h-3" /> Open console
              </button>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-md text-amber-200 hover:bg-amber-500/10 transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    expanded && "rotate-180",
                  )}
                />
                {expanded ? "Hide" : "Show"} files ({fileCount})
              </button>
            </div>
            {expanded && (
              <ul className="mt-3 max-h-48 overflow-auto scroll-soft text-[11px] font-mono text-amber-100/90 space-y-0.5 pr-2">
                {fileList.map((path) => (
                  <li
                    key={path}
                    className="px-2 py-0.5 rounded hover:bg-amber-500/10 truncate"
                    title={path}
                  >
                    {path}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Console panel — slides up from the bottom of the preview area. Shows
 * console.log / .warn / .error / .info messages forwarded from inside
 * the iframe by the nav-interceptor. Capped at 50 messages so a runaway
 * loop doesn't blow the workshop's memory.
 */
function ConsolePanel({
  messages,
  onClose,
  onClear,
}: {
  messages: Array<{ level: string; message: string; t: number }>;
  onClose: () => void;
  onClear: () => void;
}) {
  return (
    <div className="absolute bottom-0 inset-x-0 z-20 mx-3 mb-3 max-h-[40%] flex flex-col rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl shadow-black/60">
      <div className="h-9 px-3 border-b border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-foreground">
          <Terminal className="w-3.5 h-3.5 text-accent" />
          <span className="font-medium">Iframe console</span>
          <span className="text-subtle">{messages.length} message{messages.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClear}
            disabled={messages.length === 0}
            className="px-2 py-0.5 rounded text-subtle hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-0.5 rounded text-subtle hover:text-foreground hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto scroll-soft p-2 font-mono text-[11px] leading-relaxed">
        {messages.length === 0 ? (
          <div className="text-subtle px-2 py-1">
            No messages yet. The iframe&apos;s console output will stream here in real time.
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "px-2 py-1 rounded flex gap-2",
                m.level === "error" && "text-red-300 bg-red-500/5",
                m.level === "warn" && "text-amber-200 bg-amber-500/5",
                (m.level === "log" || m.level === "info") && "text-foreground/80",
              )}
            >
              <span className="text-subtle shrink-0 uppercase tracking-wider w-10 text-[9px] mt-0.5">
                {m.level}
              </span>
              <span className="flex-1 break-all whitespace-pre-wrap">{m.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Toast stack — top-right of the preview area. Auto-stacking, auto-dismiss
 * is handled by the parent (it removes ids after a timeout); this is just
 * the presentation layer with slide-in + fade-out animations driven by
 * tailwind transitions on a key per-toast.
 */
function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Array<{ id: number; tone: "info" | "warn" | "error"; message: string }>;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="absolute top-3 right-3 z-30 flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "preview-toast pointer-events-auto rounded-xl border backdrop-blur-md shadow-2xl shadow-black/60 px-3.5 py-2.5 flex items-start gap-2.5",
            t.tone === "error" && "bg-red-500/15 border-red-500/40 text-red-100",
            t.tone === "warn" && "bg-amber-500/15 border-amber-500/40 text-amber-100",
            t.tone === "info" && "bg-accent/15 border-accent/40 text-accent",
          )}
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 opacity-90" />
          <div className="text-[12px] leading-snug flex-1 break-words">
            {t.message}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="opacity-60 hover:opacity-100 transition-opacity text-[11px] font-mono shrink-0 -mt-0.5"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/** Render a styled 404 page when the iframe navigates somewhere we can't resolve. */
function build404SrcDoc(missing: string, result: GenerateResult): string {
  const knownPages = result.files
    .filter((f) => f.path === "index.html" || f.path.startsWith("pages/"))
    .map((f) => ({
      href:
        f.path === "index.html"
          ? "/"
          : `/${f.path.replace(/^pages\//, "").replace(/\.html$/, "")}`,
      label:
        f.path === "index.html"
          ? "Home"
          : f.path
              .replace(/^pages\//, "")
              .replace(/\.html$/, "")
              .replace(/[-_]/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  const list = knownPages
    .map((p) => `<li><a href="${escapeAttr(p.href)}">${p.label}</a></li>`)
    .join("");
  // We deliberately don't inject the nav interceptor here — clicks on the
  // 404 page's links should bubble up via the same postMessage path that
  // the assembled previews use, which is what the parent listens for. The
  // 404 itself is just a static doc, but its `<a>` links need
  // intercepting too. Inline a tiny handler so the parent still picks up
  // route changes from the 404.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<base target="_self" />
<title>404 — page not found</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background:#0a0a0a;
    color:#f5f5f1;
    display:grid;
    place-items:center;
    padding:48px 24px;
    text-align:center;
  }
  .wrap{max-width:520px}
  .glyph{
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size:88px;
    line-height:1;
    letter-spacing:.05em;
    background:linear-gradient(180deg,#b8e3c9 0%,#6dd99e 100%);
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
    margin:0 0 20px;
  }
  h1{font-size:24px;font-weight:600;margin:0 0 8px}
  p{color:#9b9b95;font-size:14px;margin:0 0 24px;line-height:1.6}
  code{background:#131313;border:1px solid #1f1f1f;color:#b8e3c9;padding:2px 8px;border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  li a{
    display:inline-block;padding:8px 16px;border:1px solid #1f1f1f;border-radius:999px;
    color:#f5f5f1;text-decoration:none;font-size:13px;background:#0a0a0a;
    transition:all .2s ease;
  }
  li a:hover{border-color:#b8e3c9;color:#b8e3c9;transform:translateY(-1px)}
  .home{
    margin-top:24px;display:inline-block;padding:10px 20px;border-radius:999px;font-weight:600;
    background:#b8e3c9;color:#000;text-decoration:none;font-size:14px;
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="glyph">404</div>
  <h1>This page doesn't exist yet.</h1>
  <p>The link <code>${escapeAttr(missing)}</code> isn't part of this site. Tell the AI to add it as a follow-up.</p>
  <ul>${list}</ul>
  <a class="home" href="/">← Back to home</a>
</div>
<script>
(function(){
  document.addEventListener("click", function(e) {
    var t = e.target;
    while (t && t.nodeType === 1) {
      if (t.tagName === "A") break;
      t = t.parentNode;
    }
    if (!t || t.tagName !== "A") return;
    var href = t.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    if (/^https?:\\/\\//i.test(href) || href.indexOf("mailto:") === 0) return;
    e.preventDefault();
    try { window.parent.postMessage({ type: "henosis-nav", href: href }, "*"); } catch (_) {}
  }, true);
})();
</script>
</body>
</html>`;
}
