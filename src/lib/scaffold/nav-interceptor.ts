/**
 * Navigation interceptor — shared inline script injected into every preview
 * iframe (both HTML mode and React mode).
 *
 * Why this exists:
 *   Without it, anchor clicks and form submits inside the AI-generated site
 *   can navigate the PARENT Henosis page. The user sees this as:
 *     - "the Henosis page refreshes when I click a link inside the preview"
 *     - "tab duplicates after multiple refreshes"
 *     - "clicking 'About' on the generated nav breaks my workshop"
 *
 *   This script catches every navigation attempt at capture-phase and
 *   either lets it through (hash links → smooth scroll), routes it via
 *   postMessage (internal links → parent handles), or postMessages the
 *   parent to open the URL in a new tab (external links).
 *
 *   The iframe sandbox does NOT include `allow-popups`, so the iframe
 *   itself cannot open new tabs. Every external-link request flows
 *   through the parent, which calls `window.open` with proper rel
 *   attributes — see preview-pane.tsx for the receiving end.
 *
 * The script is plain ES5 — no template literals, no const, no arrow
 * functions — so it runs in any browser the iframe srcDoc is mounted
 * inside without transpilation.
 *
 * It also wires up two safety nets:
 *   - window.onerror → posts `henosis-runtime-error` so the parent can
 *     surface an error overlay.
 *   - window.onunhandledrejection → same.
 */
export const NAV_INTERCEPTOR_JS = `
(function() {
  if (window.__henosis_nav_installed) return;
  window.__henosis_nav_installed = true;

  function isExternalHref(href) {
    if (!href) return false;
    var lower = String(href).toLowerCase();
    if (lower.indexOf("mailto:") === 0) return true;
    if (lower.indexOf("tel:") === 0) return true;
    if (lower.indexOf("sms:") === 0) return true;
    if (lower.indexOf("javascript:") === 0) return false;
    if (/^https?:\\/\\//i.test(href)) return true;
    return false;
  }

  function postToParent(msg) {
    try { window.parent.postMessage(msg, "*"); } catch (_e) {}
  }

  // ── Anchor clicks ────────────────────────────────────────────────────
  document.addEventListener("click", function(e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    // Let the user middle-click / cmd-click to open in new tab themselves.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var t = e.target;
    while (t && t.nodeType === 1) {
      if (t.tagName === "A") break;
      t = t.parentNode;
    }
    if (!t || t.tagName !== "A") return;

    var href = t.getAttribute("href");
    if (href == null) return;
    var target = t.getAttribute("target");

    // Hash anchors — let the browser smooth-scroll inside the iframe.
    if (href.charAt(0) === "#") return;

    // javascript: URLs — kill them silently.
    if (String(href).toLowerCase().indexOf("javascript:") === 0) {
      e.preventDefault();
      return;
    }

    e.preventDefault();

    if (isExternalHref(href) || target === "_blank") {
      postToParent({ type: "henosis-external", href: href });
      return;
    }

    // Internal link (relative or root-relative). Before bothering the
    // parent, try to resolve the click to a real element on the current
    // page — many AI builds emit \`<a href="/menu">\` when what they
    // really wanted was \`<a href="#menu">\` to a <section id="menu">
    // mounted on the same view. Match strategy:
    //   1. exact id ("menu" → #menu)
    //   2. with -section suffix ("menu" → #menu-section)
    //   3. data-route="menu"
    //   4. fragment piece of href if multi-segment ("/about/team" → #team)
    // If any of those hit, scroll smoothly and stop. The user gets the
    // closest-equivalent in-page jump rather than a dead click.
    var slug = String(href)
      .replace(/^\\.?\\//, "")    // strip "./" / "/"
      .replace(/\\.html$/i, "")   // strip ".html"
      .replace(/^pages\\//i, "")  // strip "pages/" prefix
      .replace(/\\/$/g, "")       // strip trailing slash
      .toLowerCase();
    var lastSeg = slug.split("/").pop() || slug;
    var candidates = [slug, lastSeg, slug + "-section", lastSeg + "-section"];
    var hit = null;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (!c) continue;
      try {
        var el = document.getElementById(c) ||
                 document.querySelector('[data-route="' + c + '"]');
        if (el) { hit = el; break; }
      } catch (_e) {}
    }
    if (hit) {
      try { hit.scrollIntoView({ behavior: "smooth", block: "start" }); }
      catch (_e) { try { hit.scrollIntoView(); } catch (_e2) {} }
      return;
    }

    // No in-iframe equivalent. Tell the parent so the HTML-mode router
    // can swap pages, or so the React-mode parent can flash a toast
    // explaining why the click went nowhere.
    postToParent({ type: "henosis-nav", href: href });
  }, true);

  // ── Form submits ─────────────────────────────────────────────────────
  document.addEventListener("submit", function(e) {
    e.preventDefault();
    var f = e.target;
    if (!f || typeof f.getAttribute !== "function") return;
    var action = f.getAttribute("action") || "";
    if (isExternalHref(action)) {
      postToParent({ type: "henosis-external", href: action });
    }
  }, true);

  // ── Runtime error reporting ──────────────────────────────────────────
  window.addEventListener("error", function(e) {
    var msg = (e && e.message) ? e.message : String(e);
    postToParent({ type: "henosis-runtime-error", message: msg });
  });
  window.addEventListener("unhandledrejection", function(e) {
    var reason = e && e.reason;
    var msg = (reason && reason.message) ? reason.message :
              (reason ? String(reason) : "Unhandled promise rejection");
    postToParent({ type: "henosis-runtime-error", message: msg });
  });

  // ── Console forwarding ──────────────────────────────────────────────
  // Wrap console.log / .warn / .error so the parent workshop can show a
  // collapsible "Iframe console" panel. Without this, when the AI ships
  // a site that's silently broken, the user has to F12 the iframe to
  // see what's happening — most users won't, and they walk away thinking
  // "the AI is shit". Now the workshop surfaces the iframe's own logs.
  function wrapConsole(level) {
    var orig = console[level];
    console[level] = function() {
      try {
        var args = Array.prototype.slice.call(arguments);
        var msg = args.map(function(a) {
          if (a == null) return String(a);
          if (typeof a === "string") return a;
          try { return JSON.stringify(a); } catch (_e) { return String(a); }
        }).join(" ");
        // Cap to 1KB so a runaway log doesn't blow the postMessage queue.
        if (msg.length > 1024) msg = msg.slice(0, 1024) + "…";
        postToParent({ type: "henosis-console", level: level, message: msg });
      } catch (_e) {}
      try { orig.apply(console, arguments); } catch (_e) {}
    };
  }
  wrapConsole("log");
  wrapConsole("warn");
  wrapConsole("error");
  wrapConsole("info");

  // Tell the parent we successfully booted (used for the loading spinner).
  postToParent({ type: "henosis-ready" });

  // Heartbeat — once a second post a small ping so the parent knows the
  // iframe is alive even when there are no logs and no nav events. The
  // workshop's boot watchdog uses this to detect "iframe loaded but JS
  // didn't run" (e.g. CSP block, network issue, bad srcDoc).
  setInterval(function() {
    postToParent({ type: "henosis-heartbeat", t: Date.now() });
  }, 1000);
})();
`;
