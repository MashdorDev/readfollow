//First-run page, opened once on install. Everything on it is optional: closing it leaves ReadFollow ready to use.

domReady().then(async () => {
  setI18nText()

  $("#pin-hint").text(brapi.i18n.getMessage(config.browserId == "firefox" ? "welcome_pin_firefox" : "welcome_pin_chrome"))

  //reads the sample with the same on-page highlighting as a selection on a web page
  $("#try-button").click(async function() {
    const sample = document.getElementById("sample")
    $("#try-status").text("")
    try {
      await bgPageInvoke("playText", [sample.textContent, {lang: document.documentElement.lang || navigator.language}])
      const range = document.createRange()
      range.selectNodeContents(sample)
      pageHighlighter.start(range, {tint: false})
      showPlaybackError()
    }
    catch (err) {
      showError(err)
    }
  })

  $("#shortcuts-button").click(() => openShortcutSettings().catch(console.error))
  await showShortcuts()
})

//A read that fails after it starts (no voice for the language, a voice service error) ends without throwing,
//so watch the player until it is reading or reports the error
async function showPlaybackError() {
  const startupTimeout = 15000
  const started = Date.now()
  while (Date.now() - started < startupTimeout) {
    const {state, playbackError} = await bgPageInvoke("getPlaybackState")
    if (playbackError) {
      showError(playbackError)
      return
    }
    if (state == "PLAYING") return
    await new Promise(resolve => setTimeout(resolve, 300))
  }
}

//Errors with a code (no voice for the language...) carry it as JSON in the message, like the popup expects
function showError(err) {
  const message = (err && err.message) || String(err)
  if (/^{/.test(message)) $("#try-status").html(formatError(JSON.parse(message)))
  else $("#try-status").text(message)
}

//A suggested shortcut that another extension already uses is left empty by the browser, without telling anyone
async function showShortcuts() {
  const commands = await brapi.commands.getAll()
  const $table = $("#shortcuts").empty()
  let missing = false
  for (const command of commands) {
    if (!command.description) continue
    const $row = $("<tr>").appendTo($table)
    $("<td>").text(command.description).appendTo($row)
    const $keys = $("<td>").appendTo($row)
    if (command.shortcut) $("<kbd>").text(command.shortcut).appendTo($keys)
    else {
      $keys.addClass("text-muted").text(brapi.i18n.getMessage("welcome_shortcut_not_set"))
      if (["play", "pause", "forward", "rewind"].includes(command.name)) missing = true
    }
  }
  $("#shortcuts-missing").prop("hidden", !missing)
}
