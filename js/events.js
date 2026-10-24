
brapi.runtime.onInstalled.addListener(function(details) {
  installContentScripts()
  installContextMenus()
  if (details.reason == "install") brapi.tabs.create({url: "welcome.html"}).catch(console.error)
  rememberVersionForWhatsNew(details).catch(console.error)
})

//Firefox can lose its saved copy of the menu, which onInstalled never recreates
brapi.runtime.onStartup.addListener(installContextMenus)

//The popup shows release highlights once, diffed against the version the update came from.
//storage.local, not sync: "has this browser shown it yet" shouldn't be eaten by another machine.
async function rememberVersionForWhatsNew({reason, previousVersion}) {
  const current = brapi.runtime.getManifest().version
  if (reason == "install") return brapi.storage.local.set({lastSeenVersion: current})
  if (reason != "update" || !previousVersion || previousVersion == current) return
  const {lastSeenVersion} = await brapi.storage.local.get({lastSeenVersion: null})
  //two updates before the popup is opened: keep the older mark so the skipped release still shows
  if (!lastSeenVersion) await brapi.storage.local.set({lastSeenVersion: previousVersion})
}

//A player tab closed mid-read is gone before it can clear the toolbar badge itself
brapi.tabs.onRemoved.addListener(function() {
  sendToPlayer({method: "getPlaybackState"})
    .then(result => result ? result.state : "STOPPED", () => "STOPPED")
    .then(state => state == "STOPPED" && showPlaybackOnButton(state))
    .catch(console.error)
})


/**
 * IPC handlers
 */
var handlers = {
  playText: playText,
  playTab: playTab,
  reloadAndPlayTab: reloadAndPlayTab,
  stop: stop,
  pause: pause,
  resume: resume,
  getPlaybackState: getPlaybackState,
  forward: forward,
  rewind: rewind,
  seek: seek,
  managePiperVoices,
}

registerMessageListener("serviceWorker", handlers)


/**
 * Installers
 */
async function installContentScripts() {
  const scripts = [
    {
      matches: ["https://docs.google.com/document/*"],
      id: "google-docs",
      js: ["js/page/google-doc.js"],
      runAt: "document_start",
      world: "MAIN"
    },
  ]
  const registeredIds = await brapi.scripting.getRegisteredContentScripts({ids: scripts.map(x => x.id)})
    .then(scripts => scripts.map(x => x.id))
    .catch(err => {
      console.error(err)
      return []
    })
  if (registeredIds.length) {
    console.info("Already registered content scripts", registeredIds)
  }
  const scriptsToRegister = scripts.filter(script => !registeredIds.includes(script.id))
  for (const script of scriptsToRegister) {
    await brapi.scripting.registerContentScripts([script])
      .then(() => console.info("Successfully registered content script", script.id))
      .catch(err => console.error("Failed to register content script", script.id, err))
  }
}

function installContextMenus() {
  if (brapi.contextMenus)
  brapi.contextMenus.removeAll(() => brapi.contextMenus.create({
    id: "read-selection",
    title: brapi.i18n.getMessage("context_read_selection"),
    contexts: ["selection"]
  },
  function() {
    if (brapi.runtime.lastError) console.error(brapi.runtime.lastError)
    else console.info("Installed context menus")
  }))
}


/**
 * Context menu handlers
 */
if (brapi.contextMenus)
brapi.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == "read-selection")
    Promise.resolve()
      .then(function() {
        if (tab && tab.id != -1) return detectTabLanguage(tab.id)
        else return undefined
      })
      .then(function(lang) {
        return Promise.all([
          highlightSelectionOnPage(tab, info.frameId),
          playText(info.selectionText, {lang: lang}),
        ])
      })
      .catch(handleHeadlessError)
})

//Only the top frame: injectContentScript can't target a subframe's getRequireJs reliably
async function highlightSelectionOnPage(tab, frameId) {
  if (!tab || tab.id == -1 || frameId) return
  try {
    if (!await contentScriptAlreadyInjected(tab)) await injectContentScript(tab)
    await brapi.tabs.sendMessage(tab.id, {dest: "contentScript", method: "startPageHighlight"})
  }
  catch (err) {
    console.warn("Can't highlight on page", err)
  }
}


/**
 * Shortcut keys handlers
 */
if (brapi.commands)
brapi.commands.onCommand.addListener(function(command) {
  if (command == "play" || command == "pause") {
    getPlaybackState()
      .then(function(stateInfo) {
        switch (stateInfo.state) {
          case "PLAYING": return command == "pause" ? pause() : stop()
          case "PAUSED": return resume()
          case "STOPPED": return playTab()
        }
      })
      .catch(handleHeadlessError)
  }
  else if (command == "stop") {
    stop()
      .catch(handleHeadlessError)
  }
  else if (command == "forward") {
    forward()
      .catch(handleHeadlessError)
  }
  else if (command == "rewind") {
    rewind()
      .catch(handleHeadlessError)
  }
})


/**
 * Listener for external calls
 */
brapi.runtime.onMessageExternal.addListener(
  (request, sender) => {
    if (request.method == "play" && typeof request.text == "string") {
      playText(request.text)
        .catch(handleHeadlessError)
    }
    else if (request.method == "pause") {
      pause()
        .catch(handleHeadlessError)
    }
    else if (request.method == "stop") {
      stop()
        .catch(handleHeadlessError)
    }
    else if (request.method == "resume") {
      resume()
        .catch(handleHeadlessError)
    }
    else {
      handleHeadlessError(new Error("Bad method call"))
    }
  })



/**
 * METHODS
 */
var currentTask = {
  task: null,
  isActive() {
    return this.task && this.task.isActive
  },
  begin() {
    if (this.task) this.task.cancel()
    return this.task = {
      isActive: true,
      cancel() {
        this.isActive = false
      },
      end() {
        if (!this.isActive) throw new Error("Canceled")
        this.isActive = false
      }
    }
  },
  cancel() {
    if (this.task) {
      this.task.cancel()
      this.task = null
    }
  }
}

async function playText(text, opts) {
  const hasPlayer = await stop().then(res => res == true, err => false)
  if (!hasPlayer) await injectPlayer(await getActiveTab())
  await sendToPlayer({method: "playText", args: [text, opts]})
}

async function playTab(tabId) {
  const tab = tabId ? await getTab(tabId) : await getActiveTab()
  if (!tab) throw new Error(JSON.stringify({code: "error_page_unreadable"}))

  const task = currentTask.begin()
  try {
    const handler = contentHandlers.find(h => h.match(tab.url || "", tab.title))
    if (handler.validate) await handler.validate(tab)
    if (handler.getSourceUri) {
      await brapi.storage.local.set({"sourceUri": handler.getSourceUri(tab)})
    }
    else {
      const frameId = handler.getFrameId && await getAllFrames(tab.id).then(frames => handler.getFrameId(frames))
      try {
        if (!await contentScriptAlreadyInjected(tab, frameId)) await injectContentScript(tab, frameId, handler.extraScripts)
        await brapi.storage.local.set({"sourceUri": "contentscript:" + tab.id})
      }
      catch (err) {
        //Firefox shows PDFs in its own viewer, which extensions can't script, so read them in ours
        if (config.browserId != "firefox" || !/^https?:/.test(tab.url) || !/Missing host permission/.test(err.message)) throw err
        await openPdfViewer(tab.id, tab.url)
        await brapi.storage.local.set({"sourceUri": "pdfviewer:"})
      }
    }
  }
  finally {
    task.end()
  }

  const hasPlayer = await stop().then(res => res == true, err => false)
  if (!hasPlayer) await injectPlayer(tab)
  await sendToPlayer({method: "playTab"})
}

async function reloadAndPlayTab(tabId) {
  const tab = tabId ? await getTab(tabId) : await getActiveTab()

  const task = currentTask.begin()
  try {
    const tabLoadComplete = new Promise(fulfill => {
      function listener(changeTabId, changeInfo) {
        if (changeTabId == tab.id && changeInfo.status == "complete") {
          brapi.tabs.onUpdated.removeListener(listener)
          fulfill()
        }
      }
      brapi.tabs.onUpdated.addListener(listener)
    })
    await brapi.tabs.reload(tab.id)
    await tabLoadComplete
  }
  finally {
    task.end()
  }

  await playTab(tab.id)
}

function stop() {
  currentTask.cancel()
  return sendToPlayer({method: "stop"})
}

function pause() {
  return sendToPlayer({method: "pause"})
}

function resume() {
  return sendToPlayer({method: "resume"})
}

async function getPlaybackState() {
  if (currentTask.isActive()) return {state: "LOADING"}
  try {
    return await sendToPlayer({method: "getPlaybackState"}) || {state: "STOPPED"}
  }
  catch (err) {
    return {state: "STOPPED"}
  }
}

function forward() {
  return sendToPlayer({method: "forward"})
}

function rewind() {
  return sendToPlayer({method: "rewind"})
}

function seek(n) {
  return sendToPlayer({method: "seek", args: [n]})
}



function handleHeadlessError(err) {
  console.error(err)
  //TODO: let user knows somehow
}

async function openPdfViewer(tabId, pdfUrl) {
  const perms = {
    origins: ["http://*/", "https://*/"]
  }
  if (!await brapi.permissions.contains(perms)) {
    throw new Error(JSON.stringify({code: "error_add_permissions", perms: perms}))
  }
  await setTabUrl(tabId, brapi.runtime.getURL("pdf-viewer.html?url=" + encodeURIComponent(pdfUrl)))
  await new Promise(f => handlers.pdfViewerCheckIn = f)
}

async function managePiperVoices() {
  const result = await sendToPlayer({method: "managePiperVoices"}).catch(err => false)
  if (result != "OK") {
    if (result == "POPOUT") await sendToPlayer({method: "close"})
    await injectPlayer()
    await sendToPlayer({method: "managePiperVoices"})
  }
}



async function contentScriptAlreadyInjected(tab, frameId) {
  const items = await brapi.scripting.executeScript({
    target: {
      tabId: tab.id,
      frameIds: frameId ? [frameId] : undefined,
    },
    func: function() {
      return typeof brapi != "undefined"
    }
  })
  return items[0].result == true
}

async function injectContentScript(tab, frameId, extraScripts) {
  await brapi.scripting.executeScript({
    target: {
      tabId: tab.id,
      frameIds: frameId ? [frameId] : undefined,
    },
    files: [
      "js/rxjs.umd.min.js",
      "js/jquery-3.7.1.min.js",
      "js/defaults.js",
      "js/messaging.js",
      "js/page-controls.js",
      "js/page-highlight.js",
      "js/content.js",
    ]
  })
  const files = extraScripts || await brapi.tabs.sendMessage(tab.id, {dest: "contentScript", method: "getRequireJs"})
  await brapi.scripting.executeScript({
    target: {
      tabId: tab.id,
      frameIds: frameId ? [frameId] : undefined,
    },
    files: files
  })
  console.info("Content handler", files)
}

async function injectPlayer(tab) {
  const settings = await getSettings(["useEmbeddedPlayer", "piperVoices"])
  const promise = new Promise(f => handlers.playerCheckIn = f)
  if (tab && settings.useEmbeddedPlayer
    //don't use embedded player if there are hosted tool voices installed
    && (settings.piperVoices || []).length == 0
  ) {
    try {
      if (tab.incognito) {
        //https://developer.chrome.com/docs/extensions/mv3/manifest/incognito/
        throw new Error("Incognito tab")
      }
      await brapi.scripting.executeScript({
        target: {tabId: tab.id},
        func: createPlayerFrame
      })
    }
    catch (err) {
      console.warn("Cannot embed player", err)
      await createPlayerTab()
    }
  }
  else {
    await createPlayerTab()
  }
  await promise
}

function createPlayerFrame() {
  const brapi = (typeof chrome != 'undefined') ? chrome : (typeof browser != 'undefined' ? browser : {})
  const frame = document.createElement("iframe")
  frame.src = brapi.runtime.getURL("player.html")
  frame.style.position = "absolute"
  frame.style.height = "0"
  frame.style.borderWidth = "0"
  document.body.appendChild(frame)
}

async function createPlayerTab() {
  const tab = await brapi.tabs.create({
    url: "player.html?autoclose",
    index: 0,
    active: false,
  })
  await brapi.tabs.update(tab.id, {pinned: true})
}



async function sendToPlayer(message) {
  message.dest = "player"
  const result = await brapi.runtime.sendMessage(message)
  if (result && result.error) throw result.error
  else return result
}
