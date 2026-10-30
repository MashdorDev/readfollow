//Opt-in error reports, off by default. An error message can quote the text being read, a page address or a
//cloud voice's response, so a message is only sent when it matches KNOWN_MESSAGES. Anything else is identified
//by its error type and where in the extension's own code it was thrown.

const REPORT_ENDPOINT = "https://glitchtip.dorzairi.com/api/11/envelope/?sentry_key=0c233d43f13849929e439ecf2ebb018a&sentry_version=7"
const REPORT_DATA_PERMISSION = "technicalAndInteraction"
const MAX_REPORTS_PER_PAGE = 5  //a failing voice retried in a loop should not send hundreds

//Asking for a permission, or a page no extension can read, is the normal flow rather than a failure
const EXPECTED_CODES = ["error_add_permissions", "error_page_unreadable", "error_file_access", "error_upload_pdf", "error_ajax_pdf"]

const KNOWN_MESSAGES = [
  /^Server returns \d{3}$/,
  /^No text found$/,
  /^Non-OK status$/,
  /^Non-PDF content$/,
  /^Failed to (get EPUB document info|flip EPUB page|get EPUB text)$/,
  /^Piper phonemizer failed with exit code -?\d+$/,
  /^This voice needs a phonemizer that ReadFollow doesn't include \([\w-]+, [\w-]+\)$/,
  /^A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received( \w+)?$/,
  /^Could not establish connection\. Receiving end does not exist\.( \w+)?$/,
]

//V8 ("at fn (chrome-extension://id/js/a.js:1:2)") and SpiderMonkey ("fn@moz-extension://id/js/a.js:1:2")
const REPORT_FRAME = /(?:at\s+(?:(.+?)\s+\()?|(.*?)@)((?:chrome|moz)-extension:\/\/[^/\s]+\/[^\s)]+?):(\d+):(\d+)\)?$/

function reportFrames(stack) {
  const frames = []
  for (const line of String(stack || "").split("\n")) {
    const m = REPORT_FRAME.exec(line.trim())
    if (!m) continue  //a page's script address would say what was being read
    frames.push({
      function: m[1] || m[2] || "?",
      //the host part of a moz-extension address is random per install, so it would identify the device
      filename: "app:///" + m[3].replace(/^[a-z-]+:\/\/[^/]+\//, ""),
      lineno: Number(m[4]),
      colno: Number(m[5]),
      in_app: true,
    })
  }
  return frames.reverse()
}

//Returns the event to send, or null when the error isn't a failure worth reporting
function describeReportError(err) {
  if (!err || err.name == "CancellationException") return null
  const message = String(err.message || err)

  let code
  let lang
  if (message.startsWith("{")) {
    try {
      const info = JSON.parse(message)
      //a cloud voice's own JSON error can land here too, so only the extension's codes count
      if (/^error_\w+$/.test(info.code)) code = info.code
      if (code && /^[a-z]{2,3}(-[a-z0-9]+)*$/i.test(info.lang)) lang = info.lang.split("-")[0].toLowerCase()
    }
    catch (e) {
      //not one of ours: falls through and is reported by type and location
    }
  }
  if (EXPECTED_CODES.includes(code)) return null

  const name = typeof err.name == "string" && /^\w+$/.test(err.name) ? err.name : "Error"
  const frames = reportFrames(err.stack)
  const known = !code && KNOWN_MESSAGES.some(re => re.test(message))
  const top = frames[frames.length - 1]
  const where = top ? `${top.filename.slice("app:///".length)}:${top.lineno}` : "unknown"
  const title = code ? code + (lang ? " " + lang : "") : known ? message : `${name} at ${where}`

  return {
    level: "error",
    message: {formatted: "Reading failed: " + title},
    fingerprint: [title],
    tags: {},
    exception: frames.length ? {values: [{type: name, value: title, stacktrace: {frames}}]} : undefined,
  }
}

function voiceFamily(voice) {
  if (!voice) return "none"
  if (isPiperVoice(voice)) return "piper"
  if (isGoogleTranslate(voice)) return "google-translate"
  return isNativeVoice(voice) ? "browser" : "cloud"
}

let reportVoice = null
let reportsSent = 0
const reportsSeen = new Set()

function setReportVoice(voice) {
  reportVoice = voice
}

async function hasReportConsent() {
  const {errorReports} = await brapi.storage.local.get(["errorReports"])
  if (!errorReports) return false
  //Chrome has no data-collection permission, so there the setting is the whole of consent.
  //Firefox also requires the grant, which can be withdrawn in about:addons at any time.
  const perms = await brapi.permissions.getAll()
  return !perms.data_collection || perms.data_collection.includes(REPORT_DATA_PERMISSION)
}

async function reportFailure(err) {
  try {
    const event = describeReportError(err)
    if (!event) return
    const key = event.fingerprint[0]
    if (reportsSent >= MAX_REPORTS_PER_PAGE || reportsSeen.has(key)) return
    if (!await hasReportConsent()) return
    reportsSeen.add(key)
    reportsSent++

    const eventId = crypto.randomUUID().replace(/-/g, "")
    const sentAt = new Date().toISOString()
    await fetch(REPORT_ENDPOINT, {
      method: "POST",
      //In Firefox a CORS request would carry Origin: moz-extension://<id>, and that id is random per install, so
      //it would identify the device. no-cors with these headers sends Origin: null. Not in Chrome: its id is the
      //same for everyone, and the player's COEP blocks a no-cors response.
      mode: config.browserId == "firefox" ? "no-cors" : "cors",
      referrerPolicy: "no-referrer",
      headers: {"Content-Type": "text/plain"},
      credentials: "omit",
      keepalive: true,  //the player can close right after a failure
      body: [
        JSON.stringify({event_id: eventId, sent_at: sentAt}),
        JSON.stringify({type: "event"}),
        JSON.stringify({
          ...event,
          tags: {voice: voiceFamily(reportVoice), browser: config.browserId},
          event_id: eventId,
          timestamp: sentAt,
          platform: "javascript",
          release: "readfollow@" + brapi.runtime.getManifest().version,
          environment: "production",
        }),
      ].join("\n"),
    })
  }
  catch (e) {
    console.debug("Error report not sent", e)  //a failed report must not become a second problem
  }
}

if (typeof module != "undefined") {
  module.exports = {describeReportError, reportFrames}
}
