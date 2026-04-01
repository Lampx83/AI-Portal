/**
 * Floating launcher (robot icon) — bottom-left, opens URL in new tab.
 * Next.js basePath: public/js → {basePath}/js/link-launch-embed.js (not /js at domain root).
 * Example: basePath /tuyen-sinh → https://ai.neu.edu.vn/tuyen-sinh/js/link-launch-embed.js
 * On any other site you only add a <script> before </body> — no extra CSS/HTML.
 * Do not use defer/async if you use data-href / data-label / data-color on the tag.
 *
 * <script src="https://YOUR_ORIGIN/tuyen-sinh/js/link-launch-embed.js"
 *   data-href="https://YOUR_ORIGIN/tuyen-sinh/…"
 *   data-label="Open page"
 *   data-color="#0061bb"></script>
 */
;(function () {
  var ROOT_ID = "link-launch-embed-root"
  if (document.getElementById(ROOT_ID)) return

  var script = document.currentScript
  if (!script) {
    var list = document.querySelectorAll('script[src*="link-launch-embed"]')
    script = list[list.length - 1]
  }

  var href =
    (script && script.getAttribute("data-href")) || "https://example.com"
  var label =
    (script && script.getAttribute("data-label")) || "Open page"
  var primary =
    (script && script.getAttribute("data-color")) || "#0061bb"

  var css =
    "#" +
    ROOT_ID +
    ".link-launch-embed{" +
    "position:fixed;" +
    "bottom:24px;" +
    "left:24px;" +
    "z-index:2147483000;" +
    "display:flex;" +
    "align-items:center;" +
    "justify-content:center;" +
    "width:56px;" +
    "height:56px;" +
    "border-radius:50%;" +
    "background:" +
    primary +
    ";" +
    "color:#fff;" +
    "box-shadow:0 4px 14px rgba(0,0,0,0.2);" +
    "text-decoration:none;" +
    "transition:transform .15s ease,box-shadow .15s ease;" +
    "font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;" +
    "}" +
    "#" +
    ROOT_ID +
    ".link-launch-embed:hover{" +
    "transform:scale(1.06);" +
    "box-shadow:0 6px 20px rgba(0,0,0,0.25);" +
    "}" +
    "#" +
    ROOT_ID +
    ".link-launch-embed:focus-visible{" +
    "outline:3px solid rgba(255,255,255,0.9);" +
    "outline-offset:3px;" +
    "}" +
    "#" +
    ROOT_ID +
    ".link-launch-embed svg{" +
    "width:28px;" +
    "height:28px;" +
    "flex-shrink:0;" +
    "}"

  var styleEl = document.createElement("style")
  styleEl.setAttribute("data-link-launch-embed", "")
  styleEl.textContent = css
  ;(document.head || document.documentElement).appendChild(styleEl)

  // Same paths as default launcher SVG in public/js/chatIframe.js
  var robotSvg =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 8V4H8"></path>' +
    '<rect x="4" y="8" width="16" height="12" rx="2"></rect>' +
    '<path d="M2 14h2"></path>' +
    '<path d="M20 14h2"></path>' +
    '<path d="M9 13v2"></path>' +
    '<path d="M15 13v2"></path>' +
    "</svg>"

  function mount() {
    var a = document.createElement("a")
    a.id = ROOT_ID
    a.className = "link-launch-embed"
    a.href = href
    a.target = "_blank"
    a.rel = "noopener noreferrer"
    a.setAttribute("aria-label", label)
    a.innerHTML = robotSvg
    document.body.appendChild(a)
  }

  if (document.body) mount()
  else document.addEventListener("DOMContentLoaded", mount)
})()
