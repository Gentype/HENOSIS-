"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GenerateResult, GenerateResultFile } from "@/lib/types";
import {
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  ExternalLink,
  Home,
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
 * Two modes:
 *
 *   1. **React project** (score ≥ 5, has src/main.tsx / App.tsx …):
 *      hand the entire file set to {@link assemblePreview}, which boots
 *      a Babel-standalone runtime inside the sandbox. Routing is the
 *      user's responsibility (it's a SPA) so we don't intercept clicks.
 *
 *   2. **Vanilla HTML project** (index.html + optional pages/*.html +
 *      shared assets): rebuild a fresh file set with whichever page the
 *      user navigated to mounted as `index.html`, then pass that to
 *      {@link assemblePreview} for asset inlining. We also inject a
 *      tiny router script that intercepts internal <a> clicks and posts
 *      navigation events back to us, and render a styled 404 page when
 *      the user clicks a link to a page the model never emitted.
 */
export function PreviewPane({ result, generating, partialContent }: PreviewPaneProps) {
  const [device, setDevice] = useState<Device>("desktop");
  const [route, setRoute] = useState<string>("index.html");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isReact = useMemo(
    () => (result ? hasReactEntry(result.files) : false),
    [result],
  );

  // Reset to index whenever the project changes
  useEffect(() => {
    setRoute("index.html");
  }, [result]);

  // Resolve an arbitrary href the iframe gave us into a known file path.
  // Handles bare names ("about"), explicit pages ("pages/about.html"),
  // root-relative ("/about"), trailing slashes, and query/hash strings.
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

  // Build the iframe document. For React: hand the original result to
  // assemblePreview untouched. For HTML: build a re-rooted clone where
  // the currently-active page sits at `index.html`, then assemble that.
  // If the route doesn't resolve, render a styled 404 + router script.
  const srcDoc = useMemo(() => {
    if (!result) return null;

    if (isReact) {
      return assemblePreview(result);
    }

    const { matched } = resolveHref(route);
    if (!matched) {
      return build404SrcDoc(route, result);
    }

    const rerooted: GenerateResult = {
      ...result,
      files: result.files
        .filter((f) => f.path !== "index.html" || matched.path === "index.html")
        .map((f) => (f.path === matched.path ? { ...f, path: "index.html" } : f)),
    };
    const html = assemblePreview(rerooted);
    if (!html) return null;
    return injectRouterScript(html);
  }, [result, route, resolveHref, isReact]);

  // Listen for navigation events posted by the injected router script.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type !== "henosis-nav") return;
      const href: string = e.data.href ?? "";
      if (!href) return;
      const { cleanRoute } = resolveHref(href);
      setRoute(cleanRoute);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resolveHref]);

  function openInNewTab() {
    if (!srcDoc) return;
    const blob = new Blob([srcDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
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
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
              height:
                device === "desktop"
                  ? "100%"
                  : `${Math.round(WIDTHS[device] * 1.4)}px`,
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

/**
 * The injected router script. Lives inline in every rendered HTML iframe
 * page so we don't have to wire a service worker. It intercepts internal
 * <a> clicks and form submissions to internal endpoints and posts a
 * `henosis-nav` message to the parent.
 */
const ROUTER_SCRIPT = `
(function() {
  function isExternal(href) {
    if (!href) return true;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return true;
    if (href.startsWith('#')) return false;
    if (/^https?:\\/\\//i.test(href)) return true;
    return false;
  }
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;
    if (a.hasAttribute('target') && a.getAttribute('target') !== '_self') return;
    if (isExternal(href)) return;
    if (href.startsWith('#')) return;
    e.preventDefault();
    try { window.parent.postMessage({ type: 'henosis-nav', href: href }, '*'); } catch (err) {}
  }, true);
  document.addEventListener('submit', function(e) {
    var f = e.target;
    if (!f || typeof f.getAttribute !== 'function') return;
    var action = f.getAttribute('action') || '';
    if (isExternal(action)) return;
    e.preventDefault();
  }, true);
})();
`;

function injectRouterScript(html: string): string {
  const tag = `<script>${ROUTER_SCRIPT}</script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${tag}\n</body>`);
  }
  return `${html}\n${tag}`;
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
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
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
<script>${ROUTER_SCRIPT}</script>
</body>
</html>`;
}
