;(function () {
  if (typeof window === "undefined") return

  function safeUrl(baseUrl, assistantAlias, params) {
    var base = String(baseUrl || "").replace(/\/+$/, "")
    var alias = encodeURIComponent(String(assistantAlias || "central").trim() || "central")
    var query = new URLSearchParams(params || {})
    var qs = query.toString()
    return base + "/assistant-embed/" + alias + (qs ? "?" + qs : "")
  }

  function createEl(tag, styleObj) {
    var el = document.createElement(tag)
    if (styleObj) Object.assign(el.style, styleObj)
    return el
  }

  function removeById(id) {
    var old = document.getElementById(id)
    if (old && old.parentNode) old.parentNode.removeChild(old)
  }

  window.initChatIframe = function initChatIframe(options) {
    var opts = options || {}
    var baseUrl = String(opts.baseUrl || "").trim()
    if (!baseUrl) {
      throw new Error("initChatIframe: baseUrl is required")
    }

    var assistantAlias = String(opts.assistantAlias || opts.alias || "central").trim() || "central"
    var brand = opts.brand || {}
    var primaryColor = String(brand.primaryColor || "#0061bb")
    var logo = typeof brand.logo === "string" ? brand.logo.trim() : ""
    var welcomeMessage = typeof brand.welcomeMessage === "string" ? brand.welcomeMessage.trim() : ""
    var fullPortalUrl = typeof opts.fullPortalUrl === "string" ? opts.fullPortalUrl.trim() : ""
    var openPortalInNewTab = opts.openPortalInNewTab !== false

    var position = opts.position === "left" ? "left" : "right"
    var width = Math.max(320, Number(opts.width || 380))
    var height = Math.max(420, Number(opts.height || 620))
    var zIndex = Number(opts.zIndex || 2147483000)
    var borderRadius = Number(opts.borderRadius || 16)
    var showWelcomeBubble = opts.showWelcomeBubble !== false
    var showHeader = opts.showHeader !== false

    var containerId = String(opts.containerId || "ai-portal-chat-iframe-root")
    removeById(containerId)
    removeById(containerId + "-bubble")

    var root = createEl("div", {
      position: "fixed",
      bottom: "24px",
      right: position === "right" ? "24px" : "",
      left: position === "left" ? "24px" : "",
      zIndex: String(zIndex),
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    })
    root.id = containerId

    var panel = createEl("div", {
      position: "absolute",
      bottom: "72px",
      right: position === "right" ? "0" : "",
      left: position === "left" ? "0" : "",
      width: width + "px",
      height: height + "px",
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "calc(100vh - 110px)",
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: borderRadius + "px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
      overflow: "hidden",
      display: "none",
      transform: "translateY(10px)",
      opacity: "0",
      transition: "opacity 180ms ease, transform 180ms ease",
    })

    var frameWrap = createEl("div", {
      width: "100%",
      height: "100%",
      background: "#fff",
    })

    var iframe = createEl("iframe", {
      width: "100%",
      height: "100%",
      border: "0",
      display: "block",
      background: "#fff",
    })
    iframe.setAttribute("title", "AI Assistant")
    iframe.setAttribute("allow", "clipboard-read; clipboard-write")
    iframe.src = safeUrl(baseUrl, assistantAlias, opts.query || {})
    frameWrap.appendChild(iframe)

    if (showHeader) {
      var header = createEl("div", {
        height: "46px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        background: primaryColor,
        color: "#fff",
      })

      var titleWrap = createEl("div", {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        minWidth: "0",
      })
      if (logo) {
        var logoImg = createEl("img", {
          width: "22px",
          height: "22px",
          borderRadius: "6px",
          objectFit: "cover",
          background: "rgba(255,255,255,0.9)",
          padding: "1px",
        })
        logoImg.src = logo
        logoImg.alt = "logo"
        titleWrap.appendChild(logoImg)
      }
      var title = createEl("div", {
        fontSize: "14px",
        fontWeight: "600",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      })
      title.textContent = opts.title || "AI Assistant"
      titleWrap.appendChild(title)

      var closeBtn = createEl("button", {
        border: "0",
        background: "transparent",
        color: "#fff",
        fontSize: "20px",
        lineHeight: "1",
        cursor: "pointer",
        width: "30px",
        height: "30px",
      })
      closeBtn.type = "button"
      if (fullPortalUrl) {
        closeBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M9 3H5a2 2 0 0 0-2 2v4"></path>' +
          '<path d="M15 3h4a2 2 0 0 1 2 2v4"></path>' +
          '<path d="M21 15v4a2 2 0 0 1-2 2h-4"></path>' +
          '<path d="M3 15v4a2 2 0 0 0 2 2h4"></path>' +
          "</svg>"
        closeBtn.title = "Open full AI Portal"
        closeBtn.setAttribute("aria-label", "Open full AI Portal")
        closeBtn.onclick = function () {
          if (openPortalInNewTab) {
            window.open(fullPortalUrl, "_blank", "noopener,noreferrer")
          } else {
            window.location.href = fullPortalUrl
          }
        }
      } else {
        closeBtn.innerHTML = "&times;"
        closeBtn.title = "Close"
        closeBtn.setAttribute("aria-label", "Close")
        closeBtn.onclick = function () {
          setOpen(false)
        }
      }

      header.appendChild(titleWrap)
      header.appendChild(closeBtn)
      panel.appendChild(header)

      frameWrap.style.height = "calc(100% - 46px)"
    }

    panel.appendChild(frameWrap)

    var defaultRobotIcon =
      '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 8V4H8"></path>' +
      '<rect x="4" y="8" width="16" height="12" rx="2"></rect>' +
      '<path d="M2 14h2"></path>' +
      '<path d="M20 14h2"></path>' +
      '<path d="M9 13v2"></path>' +
      '<path d="M15 13v2"></path>' +
      "</svg>"

    var launcher = createEl("button", {
      width: "56px",
      height: "56px",
      borderRadius: "9999px",
      border: "0",
      background: primaryColor,
      color: "#fff",
      cursor: "pointer",
      boxShadow: "0 8px 22px rgba(0,0,0,0.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "24px",
    })
    launcher.type = "button"
    launcher.setAttribute("aria-label", "Open AI chat")
    launcher.innerHTML = opts.buttonIcon || defaultRobotIcon

    var bubble = null
    if (welcomeMessage && showWelcomeBubble) {
      bubble = createEl("div", {
        position: "absolute",
        bottom: "70px",
        right: position === "right" ? "0" : "",
        left: position === "left" ? "0" : "",
        maxWidth: "260px",
        background: "#fff",
        color: "#111827",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: "12px",
        padding: "10px 12px",
        fontSize: "13px",
        lineHeight: "1.35",
        boxShadow: "0 10px 26px rgba(0,0,0,0.2)",
      })
      bubble.id = containerId + "-bubble"
      bubble.textContent = welcomeMessage
    }

    var open = false
    function setOpen(next) {
      open = !!next
      if (open) {
        if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble)
        panel.style.display = "block"
        requestAnimationFrame(function () {
          panel.style.opacity = "1"
          panel.style.transform = "translateY(0)"
        })
      } else {
        panel.style.opacity = "0"
        panel.style.transform = "translateY(10px)"
        setTimeout(function () {
          if (!open) panel.style.display = "none"
        }, 180)
      }
    }

    launcher.onclick = function () {
      setOpen(!open)
    }

    root.appendChild(panel)
    root.appendChild(launcher)
    if (bubble) root.appendChild(bubble)
    document.body.appendChild(root)

    return {
      open: function () {
        setOpen(true)
      },
      close: function () {
        setOpen(false)
      },
      destroy: function () {
        removeById(containerId)
        removeById(containerId + "-bubble")
      },
      update: function (nextOptions) {
        return window.initChatIframe(Object.assign({}, opts, nextOptions || {}))
      },
    }
  }
})()
