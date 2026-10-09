domReady().then(() => {
  setI18nText()
  $("#version").text(brapi.i18n.getMessage("about_version", [brapi.runtime.getManifest().version]))
})
