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

   Listing copy, reviewer notes and the submission checklist are in `STORE-LISTING.md`; `amo-metadata.json` carries AMO's summary, category, license and reviewer notes. CI (`.github/workflows/ci.yml`) lints, rebuilds Piper and fails if it differs from `vendor/piper`, and publishes to both stores when the manifest version changes on main or when the workflow is run by hand with "publish" ticked.

   Submitted 2026-10-10, both waiting for review:
   - **Chrome Web Store:** item `pipjjjdajcbfjbnmpnhlfkmlopmbbgkk`, uploaded by hand (the dashboard can't be driven by a browser extension). Category Make Chrome Yours > Accessibility. Verified CRX uploads stay off, since CI uploads a plain zip.
   - **Firefox Add-ons:** listed add-on `readfollow-text-to-speech-with`, version 6560731, sent by CI with the source archive. Category Language Support only (AMO rejects "Other" next to another category), tag `scholar`, contributions link GitHub Sponsors.
   - The repository was made public the same day: the store homepage and support links were 404 while it was private, and eSpeak NG's GPL needs its source available.

   Keys: the AMO API key is in Bitwarden as "AMO API key (MashdorDev)" and in the `AMO_JWT_*` secrets of this repository and Window Fullscreen's (they share it); the Chrome item ID is in "ReadFollow Chrome Web Store item" and `CWS_EXTENSION_ID`. Still missing: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET` and `CWS_REFRESH_TOKEN` for this repository, needed before the next version so CI can upload it to Chrome. Until they are set, the Chrome job skips with a warning.
6. **After the stores approve it.** Add a ReadFollow card to Window Fullscreen for YouTube (options page Support section and README), the same as the one on ReadFollow's About page, pointing at ReadFollow's store pages, in that extension's next release. Decided 2026-10-09: not before, so its live users don't land on a GitHub-only install. In this repository, the README's install section then links the two store pages ahead of the install-from-source steps.

## Not in the first release

Highlighting while reading a whole page (only selections today), keyboard shortcuts for the playback bar, remembering where the bar was dragged, a paid voice service.
