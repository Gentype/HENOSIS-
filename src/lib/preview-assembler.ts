/**
 * Preview assembler — turn a multi-file GenerateResult into a single
 * self-contained HTML document the sandboxed iframe can actually run.
 *
 * Why this exists:
 *   The iframe's `srcDoc` is an opaque string. Relative paths like
 *   `<link rel="stylesheet" href="styles.css">` or
 *   `<script src="script.js"></script>` cannot resolve because there is no
 *   base URL. So if we just hand the model's `index.html` to the iframe,
 *   the user sees unstyled, scriptless garbage even when the model emitted
 *   perfect multi-file output.
 *
 *   For React+TypeScript projects (score ≥ 5) we go further: we ship a
 *   Babel-standalone + esm.sh import-map runtime that transpiles each
 *   `src/**.tsx` file on the fly, registers it as a blob: URL, rewrites
 *   each module's relative imports to point at those blob URLs, and then
 *   dynamic-imports `src/main.tsx`. The whole React tree mounts inside
 *   the sandbox — no server-side build, no separate worker, no SaaS.
 *
 * Public API:
 *   - assemblePreview(result)            → string (HTML doc)
 *   - hasReactEntry(files)               → boolean
 *
 * Notes:
 *   - We support both `.tsx`/`.ts` and `.jsx`/`.js` source trees.
 *   - We never fetch user code over the network — everything is inlined
 *     into the iframe's HTML, so the sandbox attribute can keep
 *     `allow-same-origin` off without breaking imports.
 *   - The runtime intentionally swallows compile errors and renders them
 *     as a red <pre> inside the iframe so the user can debug.
 */
import type { GenerateResult, GenerateResultFile } from "./types";

const REACT_VERSION = "19.0.0";
const BABEL_VERSION = "7.25.6";

/**
 * Map a list of generated files into the entry-relative form the assembler
 * understands. Strips leading "./" / "/" so lookups don't have to care
 * about prefixes.
 */
function indexFiles(files: GenerateResultFile[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of files) {
    const key = f.path.replace(/^\.?\//, "");
    m.set(key, f.content);
  }
  return m;
}

/** True when the result looks like a React project (has src/main.tsx/jsx). */
export function hasReactEntry(files: GenerateResultFile[]): boolean {
  const set = new Set(files.map((f) => f.path.replace(/^\.?\//, "")));
  return (
    set.has("src/main.tsx") ||
    set.has("src/main.jsx") ||
    set.has("src/main.ts") ||
    set.has("src/main.js") ||
    set.has("src/index.tsx") ||
    set.has("src/index.jsx") ||
    set.has("src/index.ts") ||
    set.has("src/index.js") ||
    set.has("src/App.tsx") ||
    set.has("src/App.jsx") ||
    set.has("App.tsx") ||
    set.has("App.jsx")
  );
}

/**
 * Top-level entry — given a result, return the HTML document to feed
 * into the iframe `srcDoc`. Falls back gracefully if `index.html` is
 * missing.
 */
export function assemblePreview(result: GenerateResult | null): string | null {
  if (!result) return null;
  if (!result.files || result.files.length === 0) return null;

  if (hasReactEntry(result.files)) {
    return assembleReactPreview(result);
  }
  return assembleHtmlPreview(result);
}

// ---------------------------------------------------------------------------
// Vanilla HTML projects (complexity 1–4)
// ---------------------------------------------------------------------------

/**
 * Inline every `<link rel="stylesheet" href="…">` and `<script src="…">`
 * tag in index.html whose target lives in the file set. Anything we don't
 * recognise (e.g. a Google Fonts URL) is left alone.
 *
 * Also strips comments inside `<style>` and `<script>` tags? No — we
 * preserve the model's output as-is. We only do the inlining substitution.
 */
function assembleHtmlPreview(result: GenerateResult): string {
  const files = indexFiles(result.files);
  const index = files.get("index.html");
  if (!index) {
    return assembleFallbackPreview(result);
  }

  let html = index;

  // Inline <link rel="stylesheet" href="<local>"> tags.
  html = html.replace(
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi,
    (match, href: string) => {
      const key = normaliseHref(href);
      const content = files.get(key);
      if (content == null) return match;
      return `<style data-from="${escapeAttr(href)}">\n${content}\n</style>`;
    },
  );

  // Some authors emit href first, rel second — handle that too.
  html = html.replace(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*\/?>/gi,
    (match, href: string) => {
      const key = normaliseHref(href);
      const content = files.get(key);
      if (content == null) return match;
      return `<style data-from="${escapeAttr(href)}">\n${content}\n</style>`;
    },
  );

  // Inline <script src="<local>"></script> tags (preserve type=module).
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

  return html;
}

/** Drop leading "./" / "/" so file lookups work. */
function normaliseHref(href: string): string {
  return href.replace(/^\.?\//, "").split("?")[0].split("#")[0];
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function assembleFallbackPreview(result: GenerateResult): string {
  const title = escapeHtml(result.meta?.title ?? "Henosis preview");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>body{font-family:system-ui;padding:48px;color:#444;background:#fafafa}</style>
</head>
<body>
  <h1>${title}</h1>
  <p>This project did not emit an <code>index.html</code> entry; nothing to preview.</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// React + TypeScript projects (complexity 5+)
// ---------------------------------------------------------------------------

/**
 * Build the React runtime shell. We embed all source files as a JSON map
 * on `window.__HENOSIS_FILES__`, ship Babel-standalone for in-browser
 * TS/JSX transpilation, and a virtual module loader that:
 *
 *   1. transpiles each source file with the typescript + react-jsx-automatic
 *      Babel presets,
 *   2. resolves `import X from "./foo"` by trying `.tsx`, `.ts`, `.jsx`,
 *      `.js`, `/index.tsx`, etc.,
 *   3. registers each transpiled module as a `blob:` URL,
 *   4. rewrites the import specifiers in each module to point at those
 *      blob URLs (so bare imports like `react` still flow through the
 *      `<script type="importmap">` to esm.sh),
 *   5. dynamic-imports the entry file (`src/main.tsx` preferred).
 *
 * The CSS file (`src/styles.css` or `styles.css`) is inlined into the
 * `<head>` directly — we never round-trip CSS through Babel.
 */
function assembleReactPreview(result: GenerateResult): string {
  const files = indexFiles(result.files);
  const title = escapeHtml(result.meta?.title ?? "Henosis preview");

  // Inline a top-level stylesheet if present. We accept either "styles.css"
  // or "src/styles.css" (the model commonly emits both shapes).
  const stylesheetKeys = [
    "styles.css",
    "src/styles.css",
    "src/index.css",
    "index.css",
  ];
  let css = "";
  for (const k of stylesheetKeys) {
    const c = files.get(k);
    if (c) {
      css += `/* === ${k} === */\n${c}\n\n`;
    }
  }

  // Pull every source file into a JSON-friendly map. We only ship things
  // the loader can use: .tsx, .ts, .jsx, .js, .mjs, .css, .json.
  const sourceMap: Record<string, string> = {};
  for (const [path, content] of files) {
    if (/\.(tsx?|jsx?|mjs|css|json)$/.test(path)) {
      sourceMap[path] = content;
    }
  }

  // Hand-pick the entry. We prefer the more explicit ones first.
  const entryCandidates = [
    "src/main.tsx",
    "src/main.jsx",
    "src/main.ts",
    "src/main.js",
    "src/index.tsx",
    "src/index.jsx",
    "src/index.ts",
    "src/index.js",
  ];
  let entry: string | null = null;
  for (const e of entryCandidates) {
    if (files.has(e)) {
      entry = e;
      break;
    }
  }

  // Synthesise a missing entry when only App.tsx (or root-level App.tsx)
  // exists. This is the #2 cause of "import error" — model emits a tidy
  // React tree but skips src/main.tsx because the system prompt was clipped
  // or it copied a Vite project layout that uses `npm run dev` to mount.
  if (!entry) {
    const appCandidates = [
      "src/App.tsx",
      "src/App.jsx",
      "App.tsx",
      "App.jsx",
    ];
    let appPath: string | null = null;
    for (const a of appCandidates) {
      if (files.has(a)) {
        appPath = a;
        break;
      }
    }
    if (appPath) {
      // Path the synthetic main.tsx will import. Drop the "src/" prefix and
      // the extension — the runtime resolver tries .tsx/.jsx/.ts/.js.
      const importTarget = appPath
        .replace(/^src\//, "./")
        .replace(/^(?!\.\/)/, "./")
        .replace(/\.(tsx|jsx|ts|js)$/, "");
      const synthetic = [
        `// Synthesised by Henosis preview-assembler — the model omitted`,
        `// src/main.tsx, so we generated a default mount that imports App.`,
        `import React from "react";`,
        `import { createRoot } from "react-dom/client";`,
        `import App from "${importTarget}";`,
        ``,
        `const rootEl = document.getElementById("root");`,
        `if (rootEl) createRoot(rootEl).render(React.createElement(App));`,
        ``,
      ].join("\n");
      // If App lives at the root, we still want the entry under src/ so the
      // import resolver finds it. Use src/main.tsx as the synthesised path.
      sourceMap["src/main.tsx"] = synthetic;
      entry = "src/main.tsx";
    }
  }

  // Public document head. The importmap is what makes bare `import React
  // from "react"` work without npm install.
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
  <title>${title}</title>
  <style id="henosis-base">
    html, body { margin: 0; padding: 0; }
    #root { min-height: 100vh; }
    .henosis-runtime-error {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: pre-wrap;
      padding: 24px;
      color: #d22;
      background: #fff5f5;
      border-top: 1px solid #f5b5b5;
    }
  </style>
  <style id="henosis-user-styles">
${css}
  </style>
  <script type="importmap">
${JSON.stringify(importMap, null, 2)}
  </script>
  <!-- Babel-standalone with a CDN fallback chain. jsDelivr is the primary
       choice (better uptime than unpkg in our experience), unpkg is the
       backup. If the first one errors, the inline fallback below swaps
       in the second URL synchronously so the runtime loader still sees
       a populated window.Babel. -->
  <script
    src="https://cdn.jsdelivr.net/npm/@babel/standalone@${BABEL_VERSION}/babel.min.js"
    onerror="(function(){var s=document.createElement('script');s.src='https://unpkg.com/@babel/standalone@${BABEL_VERSION}/babel.min.js';document.head.appendChild(s);})()"
  ></script>
</head>
<body>
  <div id="root"></div>
  <script id="henosis-files" type="application/json">${escapeForScript(
    JSON.stringify(sourceMap),
  )}</script>
  <script>
    window.__HENOSIS_FILES__ = JSON.parse(
      document.getElementById("henosis-files").textContent || "{}"
    );
    window.__HENOSIS_ENTRY__ = ${JSON.stringify(entry)};
  </script>
  ${RUNTIME_LOADER}
</body>
</html>`;
}

/**
 * Escape `</script>` and similar terminators so the JSON payload can be
 * embedded inside a `<script>` tag without the browser closing it early.
 */
function escapeForScript(json: string): string {
  return json
    .replace(/<\/script>/gi, "<\\/script>")
    .replace(/<!--/g, "<\\!--");
}

/**
 * The runtime loader script. Stays as a string so we can keep the
 * assembler purely synchronous and tree-shake-friendly. The matching
 * `window.__HENOSIS_FILES__` / `window.__HENOSIS_ENTRY__` globals are set
 * just above in the assembled document.
 */
const RUNTIME_LOADER = `<script type="module">
(async () => {
  const FILES = window.__HENOSIS_FILES__ || {};
  const ENTRY = window.__HENOSIS_ENTRY__;
  const root = document.getElementById("root");

  function showError(title, detail) {
    const el = document.createElement("pre");
    el.className = "henosis-runtime-error";
    el.textContent = title + (detail ? "\\n\\n" + detail : "");
    document.body.appendChild(el);
  }

  if (!ENTRY) {
    showError("No entry file found.",
      "Expected one of: src/main.tsx, src/main.jsx, src/main.ts, src/main.js");
    return;
  }
  if (typeof window.Babel === "undefined") {
    showError("Babel runtime failed to load.",
      "Could not reach unpkg.com to fetch @babel/standalone. Check your network.");
    return;
  }

  // Transpile every TS/JSX file once. .js / .mjs files are passed through
  // unchanged (still through Babel so import-rewriting works on them).
  const SRC_EXT_RE = /\\.(tsx?|jsx?|mjs)$/;
  const sources = {};
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
      sources[path] = "console.error(" + JSON.stringify(
        "[" + path + "] " + (e && e.message ? e.message : String(e))
      ) + ");";
    }
  }

  // Resolve "./foo" / "../foo/bar" relative to a source path, trying
  // common extensions. Bare specifiers (e.g. "react") return null so the
  // importmap handles them.
  function resolveSpec(from, spec) {
    if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
    const fromDir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    let url;
    try {
      url = new URL(spec, "file:///" + fromDir + "/");
    } catch (e) {
      return null;
    }
    const resolved = url.pathname.replace(/^\\/+/, "");
    const tries = [
      resolved,
      resolved + ".tsx", resolved + ".ts",
      resolved + ".jsx", resolved + ".js",
      resolved + "/index.tsx", resolved + "/index.ts",
      resolved + "/index.jsx", resolved + "/index.js",
    ];
    for (const t of tries) {
      if (sources[t]) return t;
      if (FILES[t] && /\\.(css|json)$/.test(t)) return t;
    }
    return null;
  }

  // Rewrite import specifiers in each transpiled file to point at the
  // module registry IDs (\${HENOSIS_MODULE:path}). We'll swap those for
  // real blob URLs in the next pass, once we know each module's URL.
  const IMPORT_PATTERNS = [
    // import x from "./y"; import "./y"; import x, { y } from "./z"
    /(\\bfrom\\s*)(["'])([^"']+)\\2/g,
    /(\\bimport\\s+)(["'])([^"']+)\\2/g,
    /(\\bimport\\s*\\(\\s*)(["'])([^"']+)\\2/g,
  ];

  for (const path of Object.keys(sources)) {
    let code = sources[path];
    for (const re of IMPORT_PATTERNS) {
      code = code.replace(re, function (m, lead, quote, spec) {
        const target = resolveSpec(path, spec);
        if (!target) return m;
        if (/\\.css$/.test(target)) {
          // Inline-import .css → noop the import (we already inlined the
          // top-level stylesheet; per-module css-imports are best-effort).
          return lead + quote + "data:text/javascript;base64,Lyog" + quote;
        }
        if (/\\.json$/.test(target)) {
          const json = FILES[target] || "{}";
          const dataUrl = "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));
          return lead + quote + dataUrl + quote;
        }
        return lead + quote + "@@HENOSIS_BLOB[" + target + "]@@" + quote;
      });
    }
    sources[path] = code;
  }

  // Topological blob creation: visit dependencies before parents so each
  // module ends up with concrete blob URLs in its import statements. We
  // memoise to handle diamond imports; circular imports fall back to a
  // late-binding pre-allocated URL.
  const urls = {};
  const visiting = new Set();

  function getBlobUrl(path) {
    if (urls[path]) return urls[path];
    if (visiting.has(path)) {
      // Circular: pre-create a blob with the raw code; cycles in React are rare.
      const placeholder = sources[path].replace(/@@HENOSIS_BLOB\\[([^\\]]+)\\]@@/g, function (m, p) {
        return urls[p] || ("data:text/javascript;base64," + btoa("export {};"));
      });
      urls[path] = URL.createObjectURL(new Blob([placeholder], { type: "text/javascript" }));
      return urls[path];
    }
    visiting.add(path);
    let code = sources[path];
    // Materialize this module's dependencies first so their URLs exist.
    const deps = new Set();
    code.replace(/@@HENOSIS_BLOB\\[([^\\]]+)\\]@@/g, function (m, p) {
      deps.add(p);
      return m;
    });
    for (const d of deps) {
      if (!urls[d] && sources[d]) getBlobUrl(d);
    }
    code = code.replace(/@@HENOSIS_BLOB\\[([^\\]]+)\\]@@/g, function (m, p) {
      return urls[p] || ("data:text/javascript;base64," + btoa("export {};"));
    });
    urls[path] = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    visiting.delete(path);
    return urls[path];
  }

  try {
    const entryUrl = getBlobUrl(ENTRY);
    await import(/* @vite-ignore */ entryUrl);
  } catch (e) {
    showError("Runtime error while booting " + ENTRY,
      e && e.stack ? e.stack : String(e));
  }
})();
</script>`;
