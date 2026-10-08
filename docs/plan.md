# ReadFollow plan to first release

Decided on 2026-10-08. ReadFollow is a separate, rebranded product built from Read Aloud (MIT) with its full history kept. Upstream merges stop being automatic: fixes from ken107/read-aloud are picked by hand from the `upstream` remote.

## Why not an upstream PR

The maintainer wrote 15 of the 16 commits on master in 2026. Outside PRs that get merged are small (a locale file, a URL fix); larger features sit open for years (#267 keyboard media controls since 2022, #480 download audio since 2025-12). The highlighting work is about 800 lines across 11 files.

## Steps

1. **Rebrand.** Name ReadFollow in all 26 locales, new icon, README and license credit, remove the original author's website (`docs/`), hosted page scripts, extension `key` and OAuth client.
2. **Remove the original author's servers.** Everything that calls `support.readaloud.app`, `readaloud.app` or `assets.lsdsoftware.com`: premium voices, login and account, remote config, announcements, issue reports, server language detection, MathML conversion, voice demo text, the Google Voices list, the Google Docs add-on prompt. Language detection falls back to the browser's own detector. Voices kept: browser and OS voices, Google Translate, and OpenAI, Azure, Amazon Polly and IBM with the user's own API key.
   Also removed because they depended on the same servers: Google Wavenet voices (voice list from his server), Supertonic and NghiTTS voices (ttstool.com, no license), the "Use my phone" voice (readaloud.link), Kindle Cloud Reader (OCR on ttstool.com) and the Google Docs add-on bridge.
3. **Bundle Piper.** Done. The Piper voice app (MIT, ken107/piper-browser-extension) is vendored in `piper/` and built into `vendor/piper` (20MB). onnxruntime runs on one thread because extension pages can't run the blob: scripts its threads need. Russian, Luxembourgish and Arabic voices are hidden, since they needed the author's phonemizer server.
4. **Bundle pdf.js.** PDFs currently open in the original author's hosted pdf.js viewer. Ship pdf.js inside the extension so PDF reading needs no server, and so on-page highlighting can work there too.
5. **Release.** Decide the license first: the bundled espeak-ng is GPL-3.0, so either keep it as a separately licensed component (current state, see `vendor/piper/THIRD-PARTY-NOTICES.txt`) or license ReadFollow as GPL-3.0. AMO will ask for the source of the minified `vendor/piper` bundle; it is `piper/`. Then privacy policy, store listings (AMO and Chrome Web Store, search the Chrome store for "ReadFollow" by hand first), CI that signs and publishes on a version bump, the same way Window Fullscreen for YouTube does it.

## Not in the first release

Highlighting while reading a whole page (only selections today), keyboard shortcuts for the playback bar, remembering where the bar was dragged, a paid voice service.
