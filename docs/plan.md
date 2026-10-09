# ReadFollow plan to first release

Decided on 2026-10-08. ReadFollow is a separate, rebranded product built from Read Aloud (MIT) with its full history kept. Upstream merges stop being automatic: fixes from ken107/read-aloud are picked by hand from the `upstream` remote.

## Why not an upstream PR

The maintainer wrote 15 of the 16 commits on master in 2026. Outside PRs that get merged are small (a locale file, a URL fix); larger features sit open for years (#267 keyboard media controls since 2022, #480 download audio since 2025-12). The highlighting work is about 800 lines across 11 files.

## Steps

1. **Rebrand.** Name ReadFollow in all 26 locales, new icon, README and license credit, remove the original author's website (`docs/`), hosted page scripts, extension `key` and OAuth client.
2. **Remove the original author's servers.** Everything that calls `support.readaloud.app`, `readaloud.app` or `assets.lsdsoftware.com`: premium voices, login and account, remote config, announcements, issue reports, server language detection, MathML conversion, voice demo text, the Google Voices list, the Google Docs add-on prompt. Language detection falls back to the browser's own detector. Voices kept: browser and OS voices, Google Translate, and OpenAI, Azure, Amazon Polly and IBM with the user's own API key.
   Also removed because they depended on the same servers: Google Wavenet voices (voice list from his server), Supertonic and NghiTTS voices (ttstool.com, no license), the "Use my phone" voice (readaloud.link), Kindle Cloud Reader (OCR on ttstool.com) and the Google Docs add-on bridge.
3. **Bundle Piper.** Done. The Piper voice app (MIT, ken107/piper-browser-extension) is vendored in `piper/` and built into `vendor/piper` (20MB). onnxruntime runs on one thread because extension pages can't run the blob: scripts its threads need. Russian, Luxembourgish and Arabic voices are hidden, since they needed the author's phonemizer server.
4. **Bundle pdf.js.** Done. Mozilla's prebuilt viewer (legacy build, Apache-2.0) is in `vendor/pdfjs`, unchanged except for one script tag that loads `js/pdf-bridge.js`; `tools/update-pdfjs.mjs` regenerates it. The legacy build is used because the modern one calls APIs newer than Chrome 125 without polyfills, and the minimum Chrome version is now 125. Firefox can't script its own PDF viewer, so PDF tabs there are reopened in ours. The sentence and word being read are highlighted on the page with the same highlighter as web pages.
5. **Release.** Decided 2026-10-09:
   - **License:** ReadFollow stays MIT. eSpeak NG (GPL-3.0, inside the Piper phonemizer) ships as a separately licensed component with its notice in `vendor/piper/THIRD-PARTY-NOTICES.txt`, as upstream Read Aloud does.
   - **Name:** "ReadFollow: Text to Speech with Word Highlights" (47 characters; Firefox Add-ons caps names at 50), translated in every locale within the same limit.
   - **Version:** the first store release is 1.0.0.
   - **Privacy policy:** `docs/privacy-policy.md`, published on docs.dorzairi.com like Window Fullscreen's: https://docs.dorzairi.com/docs/b5c13935-107d-4363-a02d-7e7f6161f9a5/ (public; update it with `ladocs update b5c13935-107d-4363-a02d-7e7f6161f9a5 < docs/privacy-policy.md`).

   Done for the stores: the unused `ttsEngine` permission removed; pdf.js's one v-flag regex rewritten, so addons-linter reports 0 errors (its remaining warnings are inside jQuery, pdf.js and the Piper bundle); store images in `store/`.

   Still to do: listing copy for both stores (description, Chrome's single purpose and permission justifications, data use), the AMO source package with build steps for `vendor/piper`, CI that signs and publishes on a version bump the way Window Fullscreen does, and the first upload by hand on the Chrome Web Store, which creates the item ID that CI needs. Search the Chrome store for "ReadFollow" by hand before that.
6. **After the stores approve it.** Add a ReadFollow card to Window Fullscreen for YouTube (options page Support section and README), the same as the one on ReadFollow's About page, pointing at ReadFollow's store pages, in that extension's next release. Decided 2026-10-09: not before, so its live users don't land on a GitHub-only install.

## Not in the first release

Highlighting while reading a whole page (only selections today), keyboard shortcuts for the playback bar, remembering where the bar was dragged, a paid voice service.
