"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GenerateResult, GenerateResultFile } from "@/lib/types";
import {
  AlertCircle,
  ExternalLink,
  Home,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { assemblePreview, hasReactEntry } from "@/lib/preview-assembler";
import { LiveBuilder } from "./live-builder";

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

  const isReact = useMemo(
    () => (result ? hasReactEntry(result.files) : false),
    [result],
  );

  // Reset route + runtime error when the project changes
  useEffect(() => {
    setRoute("index.html");
    setRuntimeError(null);
  }, [result]);

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

  // ─── Listen for messages from the iframe nav interceptor ──────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== "object") return;
      const data = e.data as { type?: string; href?: string; message?: string };

      switch (data.type) {
        case "henosis-nav": {
          // Internal link click. React-mode SPAs handle their own
          // routing; we only react in HTML mode.
          if (isReact) return;
          const href = data.href ?? "";
          if (!href) return;
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
          // up the small badge in the chrome.
          if (typeof data.message === "string" && data.message) {
            setRuntimeError(data.message);
          }
          return;
        }
        default:
          return;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resolveHref, isReact]);

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
      <div className="h-9 px-3 border-b border-border flex items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2 text-muted min-w-0">
          <span className="inline-flex items-center gap-1.5">
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
        <div className="mx-auto w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 grid place-items-center">
          <Loader2 className="w-5 h-5 text-accent" />
        </div>
        <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          Ready when you are
        </h3>
        <p className="mt-2 text-sm text-muted">Send a prompt to start generating.</p>
      </div>
    </div>
  );
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
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
