domReady().then(() => {
  setI18nText()
  $("#version").text(brapi.i18n.getMessage("about_version", [brapi.runtime.getManifest().version]))
  //the store page for the browser this is running in
  const $store = $("#window-fullscreen-store")
  $store.attr("href", $store.data(config.browserId == "firefox" ? "firefox" : "chrome"))
})
