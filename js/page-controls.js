
//Floating playback bar shown on the page while a selection is read.
//It lives in a shadow root so the page's styles can't reach it, and in the top layer (a manual popover)
//so the page's own fixed headers and overlays can't cover it.
//Its position is remembered per site, and it can be hidden on a site from its menu.

var pageControls = (function() {
  var rates = [0.75, 1, 1.25, 1.5, 1.75, 2]
  var icons = {
    grip: "M9 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
    rewind: "M6 6h2v12H6zm3.5 6l8.5 6V6z",
    play: "M8 5v14l11-7z",
    pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
    forward: "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z",
    stop: "M6 6h12v12H6z",
    more: "M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  }
  //gap between the bar and the edge of the window when docked
  var edgeGap = 24
  //sites whose bar position is kept; the oldest is dropped past this
  var maxSavedPositions = 100
  var host = null
  var elems = null

  //colors repeat css/tokens.css, which a page can't load into the shadow root
  var css = `
    :host {
      all: initial;
      --surface: #ffffff; --text: #1f2328; --muted: #5e6470; --hover: #f2efea; --border: #e2ddd5;
      --accent: #0f766e; --accent-hover: #0b5f58; --on-accent: #ffffff;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --surface: #26282c; --text: #e8e6e3; --muted: #a3a7ae; --hover: #33363b; --border: #3a3d43;
        --accent: #4fd1c5; --accent-hover: #7ee0d6; --on-accent: #0b1f1d;
      }
    }
    .bar {
      position: relative;
      display: flex; align-items: center; gap: 2px;
      padding: 6px 4px 6px 4px;
      background: var(--surface); color: var(--text);
      border: 1px solid var(--border);
      border-radius: 999px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.16);
      font: 13px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      user-select: none;
    }
    button, select {
      font: inherit; color: inherit; background: none; border: 0; margin: 0;
      cursor: pointer; border-radius: 999px;
    }
    button { width: 34px; height: 34px; padding: 0; display: grid; place-items: center; }
    button:hover, select:hover { background: var(--hover); }
    button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    svg { width: 20px; height: 20px; fill: currentColor; }
    .grip { width: 22px; cursor: grab; color: var(--muted); }
    .grip:hover { background: none; }
    .grip:active { cursor: grabbing; }
    .toggle { width: 40px; height: 40px; background: var(--accent); color: var(--on-accent); }
    .toggle:hover { background: var(--accent-hover); }
    .toggle svg { width: 24px; height: 24px; }
    .more { width: 28px; color: var(--muted); }
    select { height: 30px; padding: 0 6px; margin: 0 2px; appearance: none; -webkit-appearance: none; font-variant-numeric: tabular-nums; }
    select option { color: var(--text); background: var(--surface); }
    .loading .toggle { opacity: 0.6; }
    .menu {
      position: absolute; right: 0; bottom: calc(100% + 8px);
      display: flex; flex-direction: column; min-width: 180px; padding: 4px;
      background: var(--surface); color: var(--text);
      border: 1px solid var(--border); border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
    }
    .menu[hidden] { display: none; }
    .at-top .menu { bottom: auto; top: calc(100% + 8px); }
    .menu button {
      width: auto; height: 36px; padding: 0 12px; display: block;
      text-align: start; white-space: nowrap; border-radius: 8px;
    }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  `

  //built with DOM calls rather than innerHTML, which pages enforcing Trusted Types would block
  function icon(name) {
    var svgNs = "http://www.w3.org/2000/svg"
    var svg = document.createElementNS(svgNs, "svg")
    svg.setAttribute("viewBox", "0 0 24 24")
    svg.setAttribute("aria-hidden", "true")
    var path = document.createElementNS(svgNs, "path")
    path.setAttribute("d", icons[name])
    svg.appendChild(path)
    return svg
  }

  function button(className, label, iconName) {
    var elem = document.createElement("button")
    elem.className = className
    elem.title = label
    elem.setAttribute("aria-label", label)
    elem.appendChild(icon(iconName))
    return elem
  }

  function menuItem(className, label) {
    var elem = document.createElement("button")
    elem.className = className
    elem.setAttribute("role", "menuitem")
    elem.textContent = label
    return elem
  }

  function show(onCommand) {
    hide()
    host = document.createElement("div")
    //the popover defaults (inset 0, margin auto, a border and background) are all overridden here
    var hostStyle = {position: "fixed", inset: "auto", left: "50%", bottom: edgeGap + "px", transform: "translateX(-50%)",
      "z-index": "2147483647", margin: "0", padding: "0", border: "0", background: "none", overflow: "visible",
      width: "auto", height: "auto", visibility: "hidden"}
    for (var name in hostStyle) host.style.setProperty(name, hostStyle[name], "important")
    var root = host.attachShadow({mode: "open"})
    //a constructed sheet rather than a <style> element, which a style-src CSP (pdf.js's viewer has one) blocks
    var sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    root.adoptedStyleSheets = [sheet]
    var bar = document.createElement("div")
    bar.className = "bar"
    bar.setAttribute("role", "toolbar")
    bar.setAttribute("aria-label", "ReadFollow")
    var grip = button("grip", "Drag to move", "grip")
    grip.tabIndex = -1
    grip.setAttribute("aria-hidden", "true")
    var rewind = button("rewind", "Previous sentence", "rewind")
    var toggle = button("toggle", "Pause", "pause")
    var forward = button("forward", "Next sentence", "forward")
    var rate = document.createElement("select")
    rate.className = "rate"
    rate.title = "Speed"
    rate.setAttribute("aria-label", "Speed")
    rates.forEach(function(value) {rate.appendChild(rateOption(value))})
    var stop = button("stop", "Stop", "stop")
    var more = button("more", "More options", "more")
    more.setAttribute("aria-haspopup", "menu")
    more.setAttribute("aria-expanded", "false")
    var menu = document.createElement("div")
    menu.className = "menu"
    menu.setAttribute("role", "menu")
    menu.hidden = true
    var moveItem = menuItem("move", "Move to top")
    var hideItem = menuItem("hide-site", "Hide the bar on this site")
    menu.append(moveItem, hideItem)
    bar.append(grip, rewind, toggle, forward, rate, stop, more, menu)
    root.append(bar)
    elems = {root: root, bar: bar, toggle: toggle, rate: rate, more: more, menu: menu, moveItem: moveItem, state: null}
    rewind.addEventListener("click", function() {onCommand("rewind")})
    forward.addEventListener("click", function() {onCommand("forward")})
    stop.addEventListener("click", function() {onCommand("stop")})
    toggle.addEventListener("click", function() {onCommand("toggle")})
    rate.addEventListener("change", function() {onCommand("rate", Number(rate.value))})
    more.addEventListener("click", function() {toggleMenu(menu.hidden)})
    moveItem.addEventListener("click", function() {
      var position = {dock: bar.classList.contains("at-top") ? "bottom" : "top"}
      toggleMenu(false)
      place(position)
      savePosition(position).catch(console.error)
    })
    hideItem.addEventListener("click", function() {
      hideOnThisSite().catch(console.error)
    })
    root.addEventListener("keydown", function(event) {
      if (event.key == "Escape" && !menu.hidden) {
        toggleMenu(false)
        more.focus()
      }
    })
    makeDraggable(grip)
    document.documentElement.appendChild(host)
    if (host.showPopover) {
      host.popover = "manual"
      host.showPopover()
    }
    var shown = host
    getSettings(["barHiddenSites", "barPositions"]).then(function(settings) {
      if (host != shown) return
      if ((settings.barHiddenSites || []).includes(location.host)) {
        hide()
        return
      }
      var position = (settings.barPositions || {})[location.host]
      if (position) place(position)
      else updateMenuSide()
      host.style.setProperty("visibility", "visible", "important")
    })
  }

  function toggleMenu(open) {
    elems.menu.hidden = !open
    elems.more.setAttribute("aria-expanded", String(open))
    if (open) elems.menu.querySelector("button").focus()
  }

  //position is {dock: "top" | "bottom"}, or {x, y} as fractions of the window, so it survives resizing
  function place(position) {
    var docked = position.dock == "top" || position.dock == "bottom"
    host.style.setProperty("transform", docked ? "translateX(-50%)" : "none", "important")
    if (docked) {
      host.style.setProperty("left", "50%", "important")
      host.style.setProperty(position.dock, edgeGap + "px", "important")
      host.style.setProperty(position.dock == "top" ? "bottom" : "top", "auto", "important")
    }
    else {
      var rect = host.getBoundingClientRect()
      host.style.setProperty("bottom", "auto", "important")
      host.style.setProperty("left", clamp(position.x * window.innerWidth, window.innerWidth - rect.width) + "px", "important")
      host.style.setProperty("top", clamp(position.y * window.innerHeight, window.innerHeight - rect.height) + "px", "important")
    }
    updateMenuSide()
  }

  function clamp(value, max) {
    return Math.min(Math.max(0, value), Math.max(0, max))
  }

  //the menu opens away from the nearer edge, and the move item offers the other end
  function updateMenuSide() {
    var atTop = host.getBoundingClientRect().top < window.innerHeight / 2
    elems.bar.classList.toggle("at-top", atTop)
    elems.moveItem.textContent = atTop ? "Move to bottom" : "Move to top"
  }

  async function savePosition(position) {
    var positions = (await getSettings(["barPositions"])).barPositions || {}
    delete positions[location.host]
    positions[location.host] = position
    var hosts = Object.keys(positions)
    hosts.slice(0, Math.max(0, hosts.length - maxSavedPositions)).forEach(function(old) {delete positions[old]})
    await updateSettings({barPositions: positions})
  }

  async function hideOnThisSite() {
    var hidden = (await getSettings(["barHiddenSites"])).barHiddenSites || []
    if (!hidden.includes(location.host)) await updateSettings({barHiddenSites: hidden.concat(location.host)})
    hide()
  }

  function rateOption(value) {
    var option = document.createElement("option")
    option.value = value
    option.textContent = value + "x"
    return option
  }

  function update(state, rate) {
    if (!elems) return
    if (state != elems.state) {
      elems.state = state
      var paused = state == "PAUSED"
      elems.toggle.replaceChildren(icon(paused ? "play" : "pause"))
      elems.toggle.title = paused ? "Play" : "Pause"
      elems.toggle.setAttribute("aria-label", elems.toggle.title)
      elems.bar.classList.toggle("loading", state == "LOADING")
    }
    if (rate != null && elems.root.activeElement != elems.rate) {
      if (!rates.includes(rate)) elems.rate.appendChild(rateOption(rate))
      elems.rate.value = String(rate)
    }
  }

  function hide() {
    if (host) host.remove()
    host = elems = null
  }

  function contains(event) {
    return host != null && event.composedPath().includes(host)
  }

  //Switches from docked to explicit left/top on the first drag, follows the pointer, and saves where it was let go
  function makeDraggable(grip) {
    grip.addEventListener("pointerdown", function(event) {
      event.preventDefault()
      toggleMenu(false)
      var rect = host.getBoundingClientRect()
      var dx = event.clientX - rect.left
      var dy = event.clientY - rect.top
      host.style.setProperty("transform", "none", "important")
      host.style.setProperty("bottom", "auto", "important")
      grip.setPointerCapture(event.pointerId)
      function move(e) {
        host.style.setProperty("left", clamp(e.clientX - dx, window.innerWidth - rect.width) + "px", "important")
        host.style.setProperty("top", clamp(e.clientY - dy, window.innerHeight - rect.height) + "px", "important")
      }
      move(event)
      grip.addEventListener("pointermove", move)
      grip.addEventListener("pointerup", function() {
        grip.removeEventListener("pointermove", move)
        if (!host) return
        var end = host.getBoundingClientRect()
        updateMenuSide()
        savePosition({x: end.left / window.innerWidth, y: end.top / window.innerHeight}).catch(console.error)
      }, {once: true})
    })
  }

  return {
    show: show,
    update: update,
    hide: hide,
    contains: contains,
  }
})();
