/**
 * Preview assembler — turn an AI-generated multi-file project into a single
 * self-contained HTML document the sandboxed iframe can boot reliably.
 *
 * Two modes, dispatched by {@link hasReactEntry}:
 *
 *   • **HTML mode** (score 1–4) — vanilla HTML/CSS/JS sites. We inline
 *     every `<link rel="stylesheet" href="local.css">` and
 *     `<script src="local.js"></script>` reference, inject Tailwind CDN
 *     so the AI can use Tailwind classes if it wants, inject `<base
 *     target="_self">` so links don't escape the iframe, and append our
 *     navigation interceptor at the end of `<body>`.
 *
 *   • **React mode** (score 5+) — full React + TypeScript projects.
 *     We discard whatever index.html / src/main.tsx the AI emitted and
 *     mount our own hardened shell:
 *       - Tailwind v3 via the official Play CDN
 *       - Google Fonts CDN if the AI references Fraunces / Syne / etc.
 *       - Babel-standalone with a 4-way CDN fallback chain
 *       - An esm.sh importmap for `react`, `react-dom`, `react/jsx-runtime`
 *       - A synthetic `src/__henosis_main.tsx` that wraps the AI's `<App />`
 *         in an ErrorBoundary, fades out the loading overlay on first
 *         commit, and routes render errors to a styled overlay.
 *       - The runtime loader (Babel transpile → blob URL topo sort →
 *         dynamic import) shipped from {@link RUNTIME_LOADER_JS}.
 *
 * What this rewrite fixes versus the previous version:
 *
 *   1. The React-mode iframe never had the navigation interceptor — that's
 *      why clicking a link inside a generated React site refreshed the
 *      Henosis page. Both modes now ship the interceptor.
 *   2. Babel-standalone failures used to leave the iframe blank. Now we
 *      poll for `window.Babel` for up to 10s and surface a styled error
 *      overlay with a "check your network" message.
 *   3. Per-file transpile errors no longer get swallowed into a console
 *      log — they bubble up to the overlay (and if the entry is the
 *      broken file, we don't even bother trying to import it).
 *   4. Loading state — the iframe shows a sage spinner and "Booting
 *      preview…" label until the React tree commits, replacing the
 *      "site flickered black for 8 seconds" UX.
 *   5. Tailwind v3 is always available — the AI can mix Tailwind utility
 *      classes with its own CSS without us touching the system prompt.
 */
import type { GenerateResult, GenerateResultFile } from "./types";
import { NAV_INTERCEPTOR_JS } from "./scaffold/nav-interceptor";
import {
  ERROR_OVERLAY_HTML,
  LOADING_OVERLAY_HTML,
  OVERLAY_CSS,
  RUNTIME_LOADER_JS,
  buildSyntheticMain,
} from "./scaffold/react-runtime";

// Versions are pinned so a regression in upstream doesn't quietly break
// existing previews. Bump deliberately when verifying a new release.
const REACT_VERSION = "19.0.0";
const BABEL_VERSION = "7.25.6";
const TAILWIND_CDN = "https://cdn.tailwindcss.com";

/** Map of normalised path → file content. */
function indexFiles(files: GenerateResultFile[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of files) {
    const key = f.path.replace(/^\.?\//, "");
    m.set(key, f.content);
  }
  return m;
}

/**
 * Detect whether the result represents a React project. Loose check —
 * any of the canonical React entry / App file paths is enough.
 */
export function hasReactEntry(files: GenerateResultFile[]): boolean {
  for (const f of files) {
    const path = f.path.replace(/^\.?\//, "");
    if (/^src\/(main|index|App)\.(tsx?|jsx?)$/.test(path)) return true;
    if (/^App\.(tsx?|jsx?)$/.test(path)) return true;
  }
  return false;
}

/**
 * Top-level entry. Returns the HTML document string for the iframe `srcDoc`
 * (or `null` for an empty result).
 */
export function assemblePreview(result: GenerateResult | null): string | null {
  if (!result) return null;
  if (!result.files || result.files.length === 0) return null;

  if (hasReactEntry(result.files)) {
    return assembleReactPreview(result);
  }
  return assembleHtmlPreview(result);
}

// ───────────────────────────────────────────────────────────────────────
// HTML mode (vanilla HTML/CSS/JS — score 1–4)
// ───────────────────────────────────────────────────────────────────────

/**
 * Inline every `<link rel="stylesheet" href="local">` and
 * `<script src="local"></script>` whose target lives in the result's file
 * set. Add Tailwind CDN, `<base target="_self">`, and the nav interceptor.
 *
 * If the AI didn't emit `index.html` we fall back to a friendly placeholder.
 */
function assembleHtmlPreview(result: GenerateResult): string {
  const files = indexFiles(result.files);
  const index = files.get("index.html");
  if (!index) return assembleFallbackPreview(result);

  let html = index;

  // Inline <link rel="stylesheet" href="local"> (rel-first ordering).
  html = html.replace(
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi,
    (match, href: string) => {
      const key = normaliseHref(href);
      const content = files.get(key);
      if (content == null) return match;
      return `<style data-from="${escapeAttr(href)}">\n${content}\n</style>`;
    },
  );
  // …and the rel-second ordering.
  html = html.replace(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*\/?>/gi,
    (match, href: string) => {
      const key = normaliseHref(href);
      const content = files.get(key);
      if (content == null) return match;
      return `<style data-from="${escapeAttr(href)}">\n${content}\n</style>`;
    },
  );

  // Inline <script src="local"></script> (preserves type=module if present).
  html = html.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (match, before: string, src: string, after: string) => {
      const key = normaliseHref(src);
      const content = files.get(key);
      if (content == null) return match;
      const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim();
      return `<script ${attrs} data-from="${escapeAttr(src)}">\n${content}\n</script>`;
    },
  );

  html = injectIntoHead(html, htmlModeHeadInjects());
  html = injectBeforeBodyClose(html, htmlModeBodyInjects());
  return html;
}

/** Tags injected into <head> for every HTML-mode preview. */
function htmlModeHeadInjects(): string {
  return [
    `<base target="_self" />`,
    // Tailwind v3 Play CDN — JIT-compiles classes found in the DOM. No-op
    // for sites that use vanilla CSS. The official URL.
    `<script src="${TAILWIND_CDN}" data-henosis-tailwind></script>`,
    // Allow loading the most common Google Fonts the AI uses without
    // requiring it to add the <link> tag itself.
    `<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
  ].join("\n");
}

/** Tags injected before </body> for every HTML-mode preview. */
function htmlModeBodyInjects(): string {
  return `<script data-henosis-nav>${NAV_INTERCEPTOR_JS}</script>`;
}

/** Drop leading "./" / "/" so file lookups work, plus strip query/hash. */
function normaliseHref(href: string): string {
  return href.replace(/^\.?\//, "").split("?")[0].split("#")[0];
}

function assembleFallbackPreview(result: GenerateResult): string {
  const title = escapeHtml(result.meta?.title ?? "Henosis preview");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>body{font-family:ui-sans-serif,system-ui;padding:48px;color:#444;background:#fafafa}</style>
</head>
<body>
  <h1>${title}</h1>
  <p>This project did not emit an <code>index.html</code> entry; nothing to preview.</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Insert raw HTML right before `</head>`, or fall back to prepending it to
 * `<body>` if there's no head, or to the document start as a last resort.
 * Used for both HTML and React modes.
 */
function injectIntoHead(html: string, injectHtml: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${injectHtml}\n</head>`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, (_m, attrs) => `<body${attrs}>\n${injectHtml}`);
  }
  return `${injectHtml}\n${html}`;
}

/** Insert raw HTML right before `</body>`, or append at end as a fallback. */
function injectBeforeBodyClose(html: string, injectHtml: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${injectHtml}\n</body>`);
  }
  return `${html}\n${injectHtml}`;
}

// ───────────────────────────────────────────────────────────────────────
// React mode (full React + TypeScript — score 5+)
// ───────────────────────────────────────────────────────────────────────

/**
 * Build the complete React preview HTML by composing our hardened shell
 * with the user's source files and a synthetic entry that wraps `<App />`
 * in an ErrorBoundary.
 */
function assembleReactPreview(result: GenerateResult): string {
  const files = indexFiles(result.files);
  const title = escapeHtml(result.meta?.title ?? "Henosis preview");

  // Inline any top-level stylesheet the AI shipped. We accept several
  // common names. CSS files imported from inside a component are
  // best-effort (the runtime loader noops them).
  const stylesheetKeys = [
    "styles.css",
    "src/styles.css",
    "src/index.css",
    "index.css",
  ];
  let userCss = "";
  for (const k of stylesheetKeys) {
    const c = files.get(k);
    if (c) userCss += `/* === ${k} === */\n${c}\n\n`;
  }

  // Source map handed to the runtime loader: every TS/JSX/JS/CSS/JSON
  // file in the project, keyed by path. Anything else (.md, package.json,
  // tsconfig.json…) is dropped — the loader doesn't need it.
  const sourceMap: Record<string, string> = {};
  for (const [path, content] of files) {
    if (/\.(tsx?|jsx?|mjs|css|json)$/.test(path) && !path.endsWith("package.json")
        && !path.endsWith("tsconfig.json")) {
      sourceMap[path] = content;
    }
  }

  // Decide what to use as the React entry. We *always* synthesise our own
  // hardened entry under `src/__henosis_main.tsx` — the AI's main.tsx is
  // ignored. This guarantees the ErrorBoundary, loading overlay hide, and
  // error reporting hook are always wired up.
  const appImport = locateAppImportPath(files);
  const synthetic = buildSyntheticMain(appImport);
  sourceMap["src/__henosis_main.tsx"] = synthetic;
  const entry = "src/__henosis_main.tsx";

  const importMap = {
    imports: {
      react: `https://esm.sh/react@${REACT_VERSION}`,
      "react/jsx-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
      "react/jsx-dev-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-dev-runtime`,
      "react-dom": `https://esm.sh/react-dom@${REACT_VERSION}`,
      "react-dom/client": `https://esm.sh/react-dom@${REACT_VERSION}/client`,
    },
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <base target="_self" />
  <title>${title}</title>

  <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Tailwind v3 via the official Play CDN. JIT scans the rendered DOM
       and generates utility CSS at runtime. The AI can use Tailwind
       classes freely; sites with vanilla CSS are unaffected. -->
  <script src="${TAILWIND_CDN}" data-henosis-tailwind></script>

  <!-- Henosis overlay (loading + error) styles -->
  <style id="henosis-overlay-css">${OVERLAY_CSS}</style>

  <!-- User stylesheet(s), inlined -->
  <style id="henosis-user-styles">
${userCss}
  </style>

  <script type="importmap">
${JSON.stringify(importMap, null, 2)}
  </script>

  <!-- Babel-standalone with a 4-CDN fallback chain. Each onerror flips to
       the next CDN; if all fail the runtime loader's 10s polling times
       out and the error overlay surfaces a "Babel failed to load" UI. -->
  <script
    src="https://cdn.jsdelivr.net/npm/@babel/standalone@${BABEL_VERSION}/babel.min.js"
    onerror="(function(){var s=document.createElement('script');s.src='https://unpkg.com/@babel/standalone@${BABEL_VERSION}/babel.min.js';s.onerror=function(){var s2=document.createElement('script');s2.src='https://esm.sh/@babel/standalone@${BABEL_VERSION}/babel.min.js';s2.onerror=function(){var s3=document.createElement('script');s3.src='https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/${BABEL_VERSION}/babel.min.js';document.head.appendChild(s3);};document.head.appendChild(s2);};document.head.appendChild(s);})()"
  ></script>
</head>
<body>
  ${LOADING_OVERLAY_HTML}
  <div id="root"></div>
  ${ERROR_OVERLAY_HTML}

  <script id="henosis-files" type="application/json">${escapeForScript(JSON.stringify(sourceMap))}</script>
  <script>
    window.__HENOSIS_FILES__ = JSON.parse(
      document.getElementById("henosis-files").textContent || "{}"
    );
    window.__HENOSIS_ENTRY__ = ${JSON.stringify(entry)};
  </script>

  <script data-henosis-nav>${NAV_INTERCEPTOR_JS}</script>
  <script type="module">${RUNTIME_LOADER_JS}</script>
</body>
</html>`;
}

/**
 * Look at the AI's file set and decide what `./App` should resolve to from
 * inside our synthetic `src/__henosis_main.tsx`. Returns the import
 * specifier (without an extension) or null when there's literally no App
 * component to mount.
 */
function locateAppImportPath(files: Map<string, string>): string | null {
  // Preferred: src/App.{tsx,jsx,ts,js} — the canonical Henosis layout.
  const srcCandidates = ["src/App.tsx", "src/App.jsx", "src/App.ts", "src/App.js"];
  for (const c of srcCandidates) {
    if (files.has(c)) return "./App";
  }

  // Fallback 1: src/index.{tsx,jsx} — Vite's other common convention.
  const srcIndex = ["src/index.tsx", "src/index.jsx"];
  for (const c of srcIndex) {
    if (files.has(c)) return "./index";
  }

  // Fallback 2: root-level App.{tsx,jsx}. Rare, but the model occasionally
  // forgets the src/ prefix. The synthetic entry lives at src/, so we need
  // a relative ".." import.
  const rootCandidates = ["App.tsx", "App.jsx", "App.ts", "App.js"];
  for (const c of rootCandidates) {
    if (files.has(c)) return "../App";
  }

  // Fallback 3: AI emitted its own src/main.tsx; import it just to get
  // its top-level effects (the synthetic ErrorBoundary won't wrap, but
  // at least something runs).
  const mainCandidates = ["src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js"];
  for (const c of mainCandidates) {
    if (files.has(c)) return "./main";
  }

  return null;
}

/**
 * Escape `</script>` and `<!--` so a JSON payload can be embedded inside a
 * `<script>` block without the parser closing it early.
 */
function escapeForScript(json: string): string {
  return json.replace(/<\/script>/gi, "<\\/script>").replace(/<!--/g, "<\\!--");
}
