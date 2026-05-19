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

    // Internal link (relative or root-relative). Tell the parent so the
    // HTML-mode router can swap pages. React-mode parent ignores these.
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

  // Tell the parent we successfully booted (used for the loading spinner).
  postToParent({ type: "henosis-ready" });
})();
`;
