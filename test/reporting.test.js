//node --test
//The privacy promise of the error reports lives in describeReportError: if a message slips through, the text
//someone is reading leaves their device, and nothing in a manual click-through would show it.

const test = require("node:test")
const assert = require("node:assert")
const {describeReportError, reportFrames} = require("../js/reporting.js")

const SECRET = "my private medical letter https://bank.example/account?id=42"

function fails(message, stack, name = "Error") {
  return Object.assign(new Error(message), {name, stack})
}

test("an unknown message never leaves, the type and location do", () => {
  const event = describeReportError(fails(SECRET, "Error: x\n    at speak (chrome-extension://abc/js/speech.js:12:5)", "TypeError"))
  assert.equal(event.message.formatted, "Reading failed: TypeError at js/speech.js:12")
  assert.ok(!JSON.stringify(event).includes("medical"))
  assert.ok(!JSON.stringify(event).includes("bank.example"))
})

test("a coded error sends the code and language, not its other fields", () => {
  const event = describeReportError(fails(JSON.stringify({code: "error_no_voice", lang: "mt-MT", note: SECRET})))
  assert.equal(event.message.formatted, "Reading failed: error_no_voice mt")
  assert.ok(!JSON.stringify(event).includes("medical"))
})

test("a language that isn't one stays out", () => {
  const event = describeReportError(fails(JSON.stringify({code: "error_no_voice", lang: SECRET})))
  assert.ok(!JSON.stringify(event).includes("medical"))
})

test("a cloud voice's JSON error is not taken for one of ours", () => {
  const event = describeReportError(fails(JSON.stringify({code: SECRET, lang: "en"})))
  assert.ok(!JSON.stringify(event).includes("medical"))
})

test("a message that looks like JSON but isn't stays out", () => {
  const event = describeReportError(fails("{" + SECRET))
  assert.ok(!JSON.stringify(event).includes("medical"))
})

test("a known message is sent as is", () => {
  const event = describeReportError(fails("This voice needs a phonemizer that ReadFollow doesn't include (hebrew, he)"))
  assert.equal(event.message.formatted, "Reading failed: This voice needs a phonemizer that ReadFollow doesn't include (hebrew, he)")
})

test("a known prefix with text appended does not pass", () => {
  const event = describeReportError(fails("Server returns 500 " + SECRET))
  assert.ok(!JSON.stringify(event).includes("medical"))
})

test("a server's message that starts like a browser's does not pass", () => {
  const event = describeReportError(fails("Could not establish connection to https://bank.example for input " + SECRET))
  assert.ok(!JSON.stringify(event).includes("bank.example"))
})

test("the browser's own messaging errors pass, with the method name", () => {
  const message = "Could not establish connection. Receiving end does not exist. getTexts"
  assert.equal(describeReportError(fails(message)).message.formatted, "Reading failed: " + message)
})

test("something thrown that isn't an Error still gets a usable type", () => {
  const event = describeReportError({message: SECRET})
  assert.equal(event.message.formatted, "Reading failed: Error at unknown")
})

test("the normal permission flow and cancelling are not failures", () => {
  assert.equal(describeReportError(fails(JSON.stringify({code: "error_add_permissions", perms: {}}))), null)
  assert.equal(describeReportError(fails("x", "", "CancellationException")), null)
  assert.equal(describeReportError(null), null)
})

test("frames drop page scripts and the per-install id, in both browsers' formats", () => {
  const frames = reportFrames([
    "TypeError: x",
    "    at speak (chrome-extension://abcdef/js/speech.js:12:5)",
    "    at https://www.youtube.com/s/player.js:1:1",
    "play@moz-extension://11111111-2222/js/document.js:7:9",
    "other@https://bank.example/account.js:1:1",
  ].join("\n"))
  assert.deepEqual(frames.map(f => f.filename), ["app:///js/document.js", "app:///js/speech.js"])
  assert.ok(!JSON.stringify(frames).includes("11111111"))
  assert.ok(!JSON.stringify(frames).includes("abcdef"))
})
