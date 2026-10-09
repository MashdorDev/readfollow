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
    }
    catch (err) {
      $("#try-status").text(err.message || String(err))
    }
  })

  $("#shortcuts-button").click(() => openShortcutSettings().catch(console.error))
  await showShortcuts()
})

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
