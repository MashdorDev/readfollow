domReady().then(() => {
  setI18nText()
  $("#version").text(brapi.i18n.getMessage("about_version", [brapi.runtime.getManifest().version]))
  //the store page for the browser this is running in
  const $store = $("#window-fullscreen-store")
  $store.attr("href", $store.data(config.browserId == "firefox" ? "firefox" : "chrome"))
  showReleaseNotes()
})

function showReleaseNotes() {
  const current = brapi.runtime.getManifest().version
  for (const entry of releasedUpTo(current)) {
    const $heading = $("<h3>").text(entry.version)
    if (entry.version == current) $("<span class='release-notes-installed'>").text(brapi.i18n.getMessage("release_notes_installed")).appendTo($heading)
    const $list = $("<ul>")
    for (const text of entry.highlights) $("<li>").text(text).appendTo($list)
    $("#release-notes-list").append($heading, $list)
  }
}
