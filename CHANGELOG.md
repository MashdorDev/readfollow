# Changelog

Every change that reaches the stores, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The short version users see in the extension (the popup after an update, and
Release notes on the About page) lives in `js/whatsnew.js`.

## [Unreleased]

## [1.0.5] - 2026-10-30

### Added
- **Optional error reports.** Off by default. Turn on "Send error reports" in Settings to tell
  the developer when reading fails. A report never contains the text you read or the page you
  read it on; see the [privacy policy](docs/privacy-policy.md).

## [1.0.4] - 2026-10-27

### Fixed
- **Pages that stopped before saying anything.** Language detection on the
  first few lines of a page could make a wild guess, such as Maltese for a
  Project Gutenberg book whose opening is a header and a list of roman
  numerals. The guess overrode the page's own language, no voice matched it,
  and reading stopped. Guesses the browser marks as unreliable are now
  ignored, and if no voice exists for a detected language the page's declared
  language is used. ([#31](https://github.com/MashdorDev/readfollow/pull/31))
- **Google Docs and Slides shared as web pages.** The mobile (`/mobilebasic`)
  and published (`/pub`) views of a Google Doc said "No text found", and a
  Google Slides deck opened with `/htmlpresent` found no text. They are plain
  web pages, and are now read like any other page. They also no longer ask for
  the Google Docs permission. ([#32](https://github.com/MashdorDev/readfollow/pull/32))

## [1.0.3] - 2026-10-24

### Added
- **What's new after an update.** The first time the popup opens after
  ReadFollow updates, it lists what changed since the version you had, then
  stays out of the way. The About page lists every release.
  ([#30](https://github.com/MashdorDev/readfollow/pull/30))

### Fixed
- **The right-click menu item in Firefox.** "Read aloud selected text" could go
  missing from the context menu and stay gone. Firefox restores an extension's
  menu from a saved copy at startup, and ReadFollow only created the item when
  it was installed or updated, so once that copy was lost nothing brought it
  back. The item is now created on every browser start.
  ([#28](https://github.com/MashdorDev/readfollow/pull/28))

## [1.0.2] - 2026-10-13

### Added
- **Exact word timing for Piper voices.** Piper now reports how long each
  sound takes, so the highlight moves on each word as it is spoken instead of
  following an estimate (median error was 78 ms, worst 266 ms). Clicking a word
  starts the audio at that word instead of at the start of its sentence.
  ([#25](https://github.com/MashdorDev/readfollow/pull/25))

### Fixed
- **Silent reads in Firefox after a click.** Clicking the text while a Piper
  sentence was still being synthesized started a second synthesis, which never
  finished on WebGPU in Firefox, and every later read stayed silent until the
  player tab closed. Synthesis now runs one sentence at a time.
  ([#25](https://github.com/MashdorDev/readfollow/pull/25))

## [1.0.1] - 2026-10-13

### Changed
- **Piper runs on WebGPU.** High quality voices took longer to synthesize a
  sentence than to say it on one CPU thread, so reading stalled between
  sentences. Synthesis now uses the graphics card when the browser has WebGPU
  (0.55 s per sentence in Chrome, 2.4 s in Firefox, down from 4.3 s and 4.9 s),
  and falls back to the CPU otherwise. The package grows by about 16 MB.
  ([#22](https://github.com/MashdorDev/readfollow/pull/22))
- **The Hebrew Piper voice is hidden.** It needs a Hebrew phonemizer that
  ReadFollow doesn't include, so installing it only led to an error.
  ([#22](https://github.com/MashdorDev/readfollow/pull/22))

### Fixed
- **Languages and Custom voices pages in Firefox.** Both pages threw on load
  and the voice list stayed empty.
  ([#23](https://github.com/MashdorDev/readfollow/pull/23))

## [1.0.0] - 2026-10-10

First release of ReadFollow, built on [Read Aloud](https://github.com/ken107/read-aloud).

### Added
- Highlights the sentence and the word being read on the page, and in PDFs
  through a bundled PDF.js viewer.
- Estimated word highlighting for voices that don't report word positions.
- Piper voices bundled in the extension, so they run offline.
- A badge on the toolbar button while something is being read.
- Its own design, 27 interface languages including Hebrew, and an About page
  with support links and credits.

### Removed
- The original author's servers and site. ReadFollow sends nothing to its
  developer.

[Unreleased]: https://github.com/MashdorDev/readfollow/compare/v1.0.5...HEAD
[1.0.5]: https://github.com/MashdorDev/readfollow/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/MashdorDev/readfollow/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/MashdorDev/readfollow/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/MashdorDev/readfollow/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/MashdorDev/readfollow/releases/tag/v1.0.1
