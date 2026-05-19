/**
 * React preview runtime — the hardened in-iframe scaffold for projects
 * with score ≥ 5 (real React + TypeScript).
 *
 * What lives in here:
 *   - {@link buildSyntheticMain}  — generates the entry that mounts the AI's
 *     `App` inside an ErrorBoundary, hides the loading screen on success,
 *     and routes runtime errors to the parent overlay.
 *   - {@link RUNTIME_LOADER_JS}    — the actual module loader that Babel-
 *     transpiles every TS/JSX file, resolves relative imports, registers
 *     transpiled code as blob: URLs, and dynamic-imports the entry.
 *   - {@link LOADING_OVERLAY_HTML} — the "Loading preview…" overlay that
 *     covers the page until the React tree renders. Hidden by the
 *     synthetic main on first commit.
 *   - {@link ERROR_OVERLAY_HTML}   — the dark sage error UI that flips on
 *     when Babel fails to load, transpilation throws, or an unhandled
 *     React error reaches the boundary.
 *
 * Design choices:
 *   - We never trust an AI-emitted index.html or main.tsx for React mode.
 *     Both get replaced by Henosis's own shell + synthetic entry so we
 *     control the loading screen, error UI, Tailwind injection, and
 *     navigation interception.
 *   - Tailwind v3 is loaded via the official Play CDN
 *     (https://cdn.tailwindcss.com). It's a runtime JIT that scans the DOM
 *     for class names and generates CSS on the fly — perfect for a
 *     no-build preview, and free for the AI to ignore (sites that use
 *     vanilla CSS still work).
 *   - Babel-standalone has a 4-CDN fallback chain (jsDelivr → unpkg →
 *     esm.sh → cdnjs). If all four fail, the error overlay flips on
 *     with a helpful "check your network" message instead of leaving
 *     a blank page.
 */

/**
 * Generate a small React entry that mounts the AI's App inside an
 * ErrorBoundary. The loader will save this under `src/__henosis_main.tsx`
 * and use it as the iframe's entry — even if the AI emitted its own
 * `src/main.tsx`, we ignore that one and use this hardened version.
 *
 * @param appImport relative specifier the entry should import from, e.g.
 *                  `./App` (resolved by the loader to `src/App.tsx`).
 *                  When `null`, the entry shows a friendly "no App found"
 *                  error instead of failing silently.
 */
export function buildSyntheticMain(appImport: string | null): string {
  if (!appImport) {
    return [
      `// Synthetic entry — Henosis runtime injected this because no App component`,
      `// could be found in the generated files.`,
      `import React from "react";`,
      `import { createRoot } from "react-dom/client";`,
      ``,
      `function MissingApp() {`,
      `  return React.createElement(`,
      `    "div",`,
      `    { style: { padding: "48px 24px", fontFamily: "ui-monospace, monospace", color: "#d22" } },`,
      `    "Henosis: no src/App.tsx (or App.jsx) found in the generated project."`,
      `  );`,
      `}`,
      ``,
      `const root = document.getElementById("root");`,
      `if (root) {`,
      `  createRoot(root).render(React.createElement(MissingApp));`,
      `  const loading = document.getElementById("henosis-loading");`,
      `  if (loading) loading.style.display = "none";`,
      `}`,
      ``,
    ].join("\n");
  }

  return [
    `// Synthetic entry — Henosis runtime injected this. It wraps the user's App`,
    `// in an ErrorBoundary so render failures surface as a styled overlay`,
    `// instead of leaving the iframe blank.`,
    `//`,
    `// We use a namespace import + manual resolution so the user is free to`,
    `// emit either \`export default function App()\` (the new contract) or`,
    `// \`export function App()\` (the old few-shot examples) — both work.`,
    `import React from "react";`,
    `import { createRoot } from "react-dom/client";`,
    `import * as __HENOSIS_APP_MODULE__ from "${appImport}";`,
    ``,
    `const App = __HENOSIS_APP_MODULE__.default || __HENOSIS_APP_MODULE__.App;`,
    ``,
    `if (typeof App !== "function") {`,
    `  if (typeof window.__henosis_showError === "function") {`,
    `    window.__henosis_showError(`,
    `      "App component not found",`,
    `      "${appImport} does not have a default export or a named \`App\` export. Add \`export default function App() { ... }\` to that file.",`,
    `      ""`,
    `    );`,
    `  }`,
    `}`,
    ``,
    `class HenosisErrorBoundary extends React.Component {`,
    `  constructor(props) {`,
    `    super(props);`,
    `    this.state = { error: null };`,
    `  }`,
    `  static getDerivedStateFromError(error) {`,
    `    return { error: error };`,
    `  }`,
    `  componentDidCatch(error, info) {`,
    `    if (typeof window.__henosis_showError === "function") {`,
    `      window.__henosis_showError(`,
    `        "React render error",`,
    `        (error && error.message) || String(error),`,
    `        (error && error.stack) || (info && info.componentStack) || ""`,
    `      );`,
    `    }`,
    `  }`,
    `  render() {`,
    `    if (this.state.error) return null;`,
    `    return this.props.children;`,
    `  }`,
    `}`,
    ``,
    `const root = document.getElementById("root");`,
    `if (root) {`,
    `  const Component = (typeof App === "function") ? App : (() => null);`,
    `  createRoot(root).render(`,
    `    React.createElement(HenosisErrorBoundary, null, React.createElement(Component, null))`,
    `  );`,
    `  const loading = document.getElementById("henosis-loading");`,
    `  if (loading) {`,
    `    requestAnimationFrame(() => { loading.style.opacity = "0"; });`,
    `    setTimeout(() => { if (loading.parentNode) loading.parentNode.removeChild(loading); }, 220);`,
    `  }`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * Loading overlay HTML — visible from initial paint until React commits.
 * The synthetic main fades + removes it on first render. Built on
 * `position: fixed` so it sits above the user's app even if their styles
 * leak into `body` margins.
 */
export const LOADING_OVERLAY_HTML = `
  <div id="henosis-loading" aria-hidden="true">
    <div class="henosis-loading__inner">
      <div class="henosis-loading__spinner"></div>
      <div class="henosis-loading__label">Booting preview…</div>
    </div>
  </div>
`;

/**
 * Error overlay HTML — hidden by default. Flips on via
 * `window.__henosis_showError(title, message, stack)` which is exposed
 * by the runtime loader script.
 */
export const ERROR_OVERLAY_HTML = `
  <div id="henosis-error" hidden role="alert">
    <div class="henosis-error__card">
      <div class="henosis-error__badge">Preview error</div>
      <h1 id="henosis-error-title">Something went wrong</h1>
      <p id="henosis-error-message"></p>
      <details>
        <summary>Stack trace</summary>
        <pre id="henosis-error-stack"></pre>
      </details>
      <div class="henosis-error__hint">
        Try editing the prompt or asking the AI to fix the error in chat.
      </div>
    </div>
  </div>
`;

/**
 * CSS for the loading and error overlays. Sage on black to match the
 * Henosis brand palette.
 */
export const OVERLAY_CSS = `
  /* Loading overlay --------------------------------------------------- */
  #henosis-loading {
    position: fixed; inset: 0;
    display: grid; place-items: center;
    background: #0a0a0a;
    color: #f5f5f1;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    z-index: 2147483646;
    transition: opacity .2s ease;
    pointer-events: none;
  }
  .henosis-loading__inner { text-align: center; }
  .henosis-loading__spinner {
    width: 36px; height: 36px;
    margin: 0 auto 14px;
    border-radius: 9999px;
    border: 2px solid rgba(184,227,201,0.18);
    border-top-color: #b8e3c9;
    animation: henosis-spin 0.9s linear infinite;
  }
  .henosis-loading__label {
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(245,245,241,0.6);
  }
  @keyframes henosis-spin { to { transform: rotate(360deg); } }

  /* Error overlay ----------------------------------------------------- */
  #henosis-error {
    position: fixed; inset: 0;
    display: grid; place-items: center;
    background: rgba(10,10,10,0.94);
    backdrop-filter: blur(8px);
    color: #f5f5f1;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    z-index: 2147483647;
    padding: 24px;
  }
  #henosis-error[hidden] { display: none !important; }
  .henosis-error__card {
    max-width: 560px; width: 100%;
    background: #131313;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px;
    padding: 28px;
    box-shadow: 0 30px 80px -10px rgba(0,0,0,0.7);
  }
  .henosis-error__badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255,90,90,0.12);
    border: 1px solid rgba(255,90,90,0.35);
    color: #ffb3b3;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 600;
  }
  #henosis-error h1 {
    margin: 14px 0 8px;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  #henosis-error p {
    margin: 0 0 14px;
    color: rgba(245,245,241,0.78);
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  }
  #henosis-error details {
    background: #0a0a0a;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 14px;
  }
  #henosis-error summary {
    cursor: pointer;
    color: #b8e3c9;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  #henosis-error pre {
    margin: 10px 0 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    line-height: 1.5;
    color: rgba(245,245,241,0.6);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow: auto;
  }
  .henosis-error__hint {
    font-size: 12px;
    color: rgba(245,245,241,0.5);
    margin-top: 6px;
  }
`;

/**
 * The runtime loader. Runs as `<script type="module">` after the iframe
 * document has parsed. It:
 *
 *   1. Polls for `window.Babel` to appear (CDN fallback chain in the
 *      `<head>` is asynchronous). Times out after 10s and shows the
 *      error overlay if Babel never lands.
 *   2. Transpiles every `.tsx?/.jsx?/.mjs` file in `window.__HENOSIS_FILES__`
 *      via Babel's `typescript` + `react` (automatic runtime) presets.
 *      Babel errors are caught per-file and surfaced through the overlay.
 *   3. Resolves every `import` / `from "./x"` to a registered file path,
 *      trying `.tsx, .ts, .jsx, .js, /index.tsx, /index.js`.
 *   4. Builds module blob URLs in topological order so deps land first.
 *      Cyclic imports get a placeholder blob URL pre-allocated.
 *   5. `import()`s the entry blob URL. Any thrown error → overlay.
 *
 * Exposes `window.__henosis_showError(title, message, stack)` so the
 * synthetic main's ErrorBoundary can surface React render errors too.
 */
export const RUNTIME_LOADER_JS = `
(async function bootHenosisRuntime() {
  const FILES = window.__HENOSIS_FILES__ || {};
  const ENTRY = window.__HENOSIS_ENTRY__;

  // ─── Error overlay API ─────────────────────────────────────────────
  function showError(title, message, stack) {
    try {
      const root = document.getElementById("henosis-error");
      const t = document.getElementById("henosis-error-title");
      const m = document.getElementById("henosis-error-message");
      const s = document.getElementById("henosis-error-stack");
      if (t) t.textContent = title || "Preview error";
      if (m) m.textContent = message || "";
      if (s) s.textContent = stack || "";
      if (root) root.hidden = false;
      const loading = document.getElementById("henosis-loading");
      if (loading && loading.parentNode) {
        loading.parentNode.removeChild(loading);
      }
    } catch (_e) {}
  }
  window.__henosis_showError = showError;

  // ─── Babel readiness ──────────────────────────────────────────────
  async function waitForBabel(timeoutMs) {
    const t0 = performance.now();
    while (typeof window.Babel === "undefined") {
      if (performance.now() - t0 > timeoutMs) return false;
      await new Promise((r) => setTimeout(r, 50));
    }
    return true;
  }

  if (!ENTRY) {
    showError(
      "No entry file",
      "The AI didn't include any of: src/App.tsx, src/main.tsx, App.tsx. Ask in chat for an App component.",
      ""
    );
    return;
  }

  const ready = await waitForBabel(10_000);
  if (!ready) {
    showError(
      "Babel runtime failed to load",
      "Could not fetch @babel/standalone from any of jsDelivr / unpkg / esm.sh / cdnjs. Check your network connection or ad-blocker, then refresh the preview.",
      ""
    );
    return;
  }

  // ─── Transpile ────────────────────────────────────────────────────
  const SRC_EXT_RE = /\\.(tsx?|jsx?|mjs)$/;
  const sources = {};
  let firstTranspileError = null;
  for (const path of Object.keys(FILES)) {
    if (!SRC_EXT_RE.test(path)) continue;
    try {
      sources[path] = window.Babel.transform(FILES[path], {
        filename: path,
        presets: [
          ["typescript", {
            isTSX: /\\.tsx$/.test(path),
            allExtensions: true,
            onlyRemoveTypeImports: true,
          }],
          ["react", { runtime: "automatic" }],
        ],
        sourceType: "module",
      }).code;
    } catch (e) {
      const msg = "[" + path + "] " + (e && e.message ? e.message : String(e));
      sources[path] = "throw new Error(" + JSON.stringify(msg) + ");";
      if (!firstTranspileError) firstTranspileError = { path: path, message: msg };
    }
  }

  // If a transpile error happened in the entry chain, surface it now —
  // before we attempt to load the entry, which would just fail silently.
  if (firstTranspileError && firstTranspileError.path === ENTRY) {
    showError("Compile error", firstTranspileError.message, "");
    return;
  }

  // ─── Import resolver ──────────────────────────────────────────────
  function resolveSpec(from, spec) {
    if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
    const fromDir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    let url;
    try { url = new URL(spec, "file:///" + fromDir + "/"); }
    catch (_e) { return null; }
    const resolved = url.pathname.replace(/^\\/+/, "");
    const tries = [
      resolved,
      resolved + ".tsx",
      resolved + ".ts",
      resolved + ".jsx",
      resolved + ".js",
      resolved + "/index.tsx",
      resolved + "/index.ts",
      resolved + "/index.jsx",
      resolved + "/index.js",
    ];
    for (const t of tries) {
      if (sources[t]) return t;
      if (FILES[t] && /\\.(css|json)$/.test(t)) return t;
    }
    return null;
  }

  // ─── Rewrite import specifiers to placeholder tokens ───────────────
  const IMPORT_PATTERNS = [
    /(\\bfrom\\s*)([\"'])([^\"']+)\\2/g,
    /(\\bimport\\s+)([\"'])([^\"']+)\\2/g,
    /(\\bimport\\s*\\(\\s*)([\"'])([^\"']+)\\2/g,
  ];
  for (const path of Object.keys(sources)) {
    let code = sources[path];
    for (const re of IMPORT_PATTERNS) {
      code = code.replace(re, function(m, lead, q, spec) {
        const target = resolveSpec(path, spec);
        if (!target) return m;
        if (/\\.css$/.test(target)) {
          // CSS import → noop module. Top-level styles are inlined into <head> already.
          return lead + q + "data:text/javascript;base64,Lyog" + q;
        }
        if (/\\.json$/.test(target)) {
          const json = FILES[target] || "{}";
          const dataUrl = "data:application/json;base64,"
            + btoa(unescape(encodeURIComponent(json)));
          return lead + q + dataUrl + q;
        }
        return lead + q + "@@HENOSIS_BLOB[" + target + "]@@" + q;
      });
    }
    sources[path] = code;
  }

  // ─── Build blob URLs in topological order ──────────────────────────
  const urls = {};
  const visiting = new Set();
  function getBlobUrl(path) {
    if (urls[path]) return urls[path];
    if (visiting.has(path)) {
      // Cyclic — emit a placeholder that will get patched when the cycle resolves.
      const placeholder = sources[path].replace(
        /@@HENOSIS_BLOB\\[([^\\]]+)\\]@@/g,
        function(m, p) { return urls[p] || "data:text/javascript;base64,ZXhwb3J0IHt9Ow=="; }
      );
      urls[path] = URL.createObjectURL(new Blob([placeholder], { type: "text/javascript" }));
      return urls[path];
    }
    visiting.add(path);
    let code = sources[path];
    const deps = new Set();
    code.replace(/@@HENOSIS_BLOB\\[([^\\]]+)\\]@@/g, function(m, p) { deps.add(p); return m; });
    for (const d of deps) { if (!urls[d] && sources[d]) getBlobUrl(d); }
    code = code.replace(/@@HENOSIS_BLOB\\[([^\\]]+)\\]@@/g, function(m, p) {
      return urls[p] || "data:text/javascript;base64,ZXhwb3J0IHt9Ow==";
    });
    urls[path] = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    visiting.delete(path);
    return urls[path];
  }

  try {
    const entryUrl = getBlobUrl(ENTRY);
    await import(/* @vite-ignore */ entryUrl);
  } catch (e) {
    showError(
      "Runtime error while booting the app",
      (e && e.message) || String(e),
      (e && e.stack) || ""
    );
  }
})();
`;
