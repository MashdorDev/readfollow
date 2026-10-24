//node --test
//The version arithmetic behind the popup's update note. Get it wrong and users see a stale note
//forever or never see one, and neither shows up in a manual click-through.

const test = require("node:test")
const assert = require("node:assert")
const {compareVersions, highlightsSince, releasedUpTo, ENTRIES} = require("../js/whatsnew.js")

const FIXTURES = [
  {version: "2.0.0", highlights: ["two"]},
  {version: "1.2.0", highlights: ["one-two"]},
  {version: "1.1.0", highlights: ["one-one"]},
]

test("compareVersions compares numbers, not strings", () => {
  assert.equal(compareVersions("1.0.10", "1.0.9"), 1)
  assert.equal(compareVersions("1.0.9", "1.0.10"), -1)
  assert.equal(compareVersions("1.0", "1.0.0"), 0)
})

test("a fresh install is shown nothing", () => {
  assert.deepEqual(highlightsSince(null, "2.0.0", FIXTURES), [])
})

test("nothing is shown once the running version has been seen", () => {
  assert.deepEqual(highlightsSince("2.0.0", "2.0.0", FIXTURES), [])
})

test("a skipped release is not lost", () => {
  assert.deepEqual(highlightsSince("1.0.0", "2.0.0", FIXTURES).map(e => e.version), ["2.0.0", "1.2.0", "1.1.0"])
})

test("an entry ahead of the running version is not shown yet", () => {
  assert.deepEqual(highlightsSince("1.1.0", "1.2.0", FIXTURES).map(e => e.version), ["1.2.0"])
  assert.deepEqual(releasedUpTo("1.2.0", FIXTURES).map(e => e.version), ["1.2.0", "1.1.0"])
})

test("a downgrade shows nothing", () => {
  assert.deepEqual(highlightsSince("2.0.0", "1.2.0", FIXTURES), [])
})

test("every real entry has a version and at least one highlight", () => {
  for (const e of ENTRIES) {
    assert.match(e.version, /^\d+\.\d+\.\d+$/)
    assert.ok(e.highlights.length > 0, e.version)
  }
})
