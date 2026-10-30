
//Release highlights: shown once in the popup after an update, and in full on the About page.
//CHANGELOG.md is the record for people reading the repo. These are for someone who opened
//the popup to read something: one or two lines per release, about what they will notice.
//A release with nothing a user would notice gets no entry, and the popup just says it updated.
//No dependencies and no side effects, so the tests can require it directly.

var WHATS_NEW_ENTRIES = [
  {
    version: "1.0.5",
    highlights: [
      "New in Settings: you can choose to send error reports when reading fails. They stay off unless you turn them on, and never include what you read.",
    ],
  },
  {
    version: "1.0.4",
    highlights: [
      "Some pages, such as Project Gutenberg books, stopped before saying a word because ReadFollow guessed the wrong language. It now trusts the page when the guess is shaky.",
      "Google Docs opened in their mobile or published view, and Google Slides opened as a web page, are read again.",
    ],
  },
  {
    version: "1.0.3",
    highlights: [
      "In Firefox, \"Read aloud selected text\" could vanish from the right-click menu and stay gone. It is now added back every time the browser starts.",
      "ReadFollow now tells you what changed after it updates, and the About page lists every release.",
    ],
  },
  {
    version: "1.0.2",
    highlights: [
      "Piper voices highlight each word right as it is spoken, and clicking a word starts reading from that word instead of the start of its sentence.",
      "In Firefox, clicking the text while a Piper sentence was still loading no longer leaves every later read silent.",
    ],
  },
  {
    version: "1.0.1",
    highlights: [
      "High quality Piper voices no longer pause between sentences. They now run on your graphics card when the browser supports it.",
      "In Firefox, the Languages and Custom voices pages load again.",
      "The Hebrew Piper voice is hidden for now, because the part it needs to pronounce Hebrew isn't included yet.",
    ],
  },
  {
    version: "1.0.0",
    highlights: [
      "First release.",
    ],
  },
]

//Unparseable segments count as 0 rather than throwing: a bad compare must not break the popup
function compareVersions(a, b) {
  var pa = String(a).split(".")
  var pb = String(b).split(".")
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var na = parseInt(pa[i], 10) || 0
    var nb = parseInt(pb[i], 10) || 0
    if (na != nb) return na < nb ? -1 : 1
  }
  return 0
}

//Everything shipped by the running version, newest first. An entry is written before the
//manifest bump lands, so anything ahead of current is unreleased and left out.
function releasedUpTo(current, entries) {
  if (!current) return []
  return (entries || WHATS_NEW_ENTRIES)
    .filter(e => compareVersions(e.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version))
}

//Releases after the last version seen, up to the running one. A fresh install has nothing to compare.
function highlightsSince(lastSeen, current, entries) {
  if (!lastSeen) return []
  return releasedUpTo(current, entries).filter(e => compareVersions(e.version, lastSeen) > 0)
}

if (typeof module != "undefined" && module.exports) {
  module.exports = {ENTRIES: WHATS_NEW_ENTRIES, compareVersions, releasedUpTo, highlightsSince}
}
