# Store listing copy

What to paste into the Chrome Web Store and Firefox Add-ons (AMO) forms for ReadFollow 1.0.0. Images are in `store/` (see `store/README.md`).

## Name

`ReadFollow: Text to Speech with Word Highlights` (47 characters; AMO's limit is 50, Chrome's 75). It comes from `extension_name` in each locale, so both stores show the translated name.

## Summary (AMO, max 250 characters; also the Chrome short description, max 132)

Chrome takes `extension_description` from the manifest (130 characters):

Reads text aloud and highlights each word on the page as it is spoken. Works on web pages and PDFs, offline or with online voices.

For AMO's summary field, the same sentence plus one more:

Reads text aloud and highlights each word on the page as it is spoken. Works on web pages and PDFs, offline or with online voices. Free and open source, with no account and no ads.

## Description (AMO, Markdown without headings)

```markdown
**ReadFollow** reads text aloud and highlights each word on the page as it is spoken, so you can follow along with your eyes.

**How to use it**

- Select text on any page and press **Alt+O**, or right-click it and choose "Read aloud selected text".
- The sentence being read turns blue and the current word is marked in amber and underlined.
- A small bar gives you previous and next sentence, pause, speed and stop. Drag it anywhere; it remembers the spot on each site, and you can hide it on a site from its menu.
- Click any word in the selection to jump there.
- With nothing selected, the toolbar button reads the whole page and shows the text in the popup as it goes.

**PDFs too.** PDFs open in a built-in PDF.js viewer with the same highlighting, so no PDF is uploaded anywhere.

**Voices**

- The voices on your computer, which highlight word by word.
- Piper voices: natural voices you download once that then run on your device, offline.
- Google Translate voices for many languages.
- Your own OpenAI, Microsoft Azure, Amazon Polly or IBM Watson account, if you have one.

For voices that don't report word positions, ReadFollow works out the word from the length of each piece of audio, so the highlight keeps time with the voice.

**Made to be read**

Highlight colors to choose from, including an underline-only style, light and dark themes, full keyboard use, and an interface in 27 languages, including Arabic and Hebrew right to left.

**Your text**

With the voices on your computer and Piper voices, text never leaves your device. Online voices receive only the text you ask them to read, and Settings shows which service gets it for the voice you picked. ReadFollow has no account, no analytics and no ads, and the developer receives nothing. [Privacy policy](https://docs.dorzairi.com/docs/b5c13935-107d-4363-a02d-7e7f6161f9a5/)

**Open source**

ReadFollow is built on [Read Aloud](https://github.com/ken107/read-aloud) by Hai Phan and is MIT licensed. Source, credits and issues: [github.com/MashdorDev/readfollow](https://github.com/MashdorDev/readfollow). It is not affiliated with or endorsed by Read Aloud or its author.
```

## Chrome Web Store description (plain text)

```text
ReadFollow reads text aloud and highlights each word on the page as it is spoken, so you can follow along with your eyes.

HOW TO USE IT
- Select text on any page and press Alt+O, or right-click it and choose "Read aloud selected text".
- The sentence being read turns blue and the current word is marked in amber and underlined.
- A small bar gives you previous and next sentence, pause, speed and stop. Drag it anywhere; it remembers the spot on each site.
- Click any word in the selection to jump there.
- With nothing selected, the toolbar button reads the whole page.

PDFS TOO
PDFs open in a built-in PDF.js viewer with the same highlighting. No PDF is uploaded anywhere.

VOICES
- The voices on your computer, which highlight word by word.
- Piper voices: natural voices you download once that then run on your device, offline.
- Google Translate voices for many languages.
- Your own OpenAI, Microsoft Azure, Amazon Polly or IBM Watson account.
For voices that don't report word positions, ReadFollow works out the word from the length of each piece of audio, so the highlight keeps time with the voice.

MADE TO BE READ
Highlight colors to choose from, including an underline-only style, light and dark themes, full keyboard use, and an interface in 27 languages, including Arabic and Hebrew right to left.

YOUR TEXT
With the voices on your computer and Piper voices, text never leaves your device. Online voices receive only the text you ask them to read. ReadFollow has no account, no analytics and no ads.

Free and open source (MIT), built on Read Aloud by Hai Phan: https://github.com/MashdorDev/readfollow
Not affiliated with or endorsed by Read Aloud or its author.
```

## Categories

- **Chrome:** Accessibility.
- **AMO:** Language Support (AMO has no accessibility category, and "Other" can't be combined with another category).

## Screenshot captions

| File | Caption |
|---|---|
| `store/screenshot-1-web.png` | Each word is highlighted as it is read |
| `store/screenshot-2-pdf.png` | PDFs too, with the same highlighting |
| `store/screenshot-3-popup.png` | Play, pause and change speed from the toolbar |
| `store/screenshot-4-settings.png` | Choose the voice, speed and highlight colors |

Chrome also takes `store/promo-tile-440x280.png` (small promo tile, required) and `store/marquee-1400x560.png` (marquee, optional). The store icon is `img/icon.png`.

## Links

- Homepage and support: https://github.com/MashdorDev/readfollow (issues: https://github.com/MashdorDev/readfollow/issues)
- Privacy policy: https://docs.dorzairi.com/docs/b5c13935-107d-4363-a02d-7e7f6161f9a5/
- License (AMO): MIT. eSpeak NG inside the Piper voices is GPL-3.0, shipped as a separate component with its notice in `vendor/piper/THIRD-PARTY-NOTICES.txt`.

## Chrome privacy practices tab

**Single purpose:** Read text on web pages and PDFs aloud while highlighting the sentence and word being spoken.

**Permission justifications:**

| Permission | Justification |
|---|---|
| activeTab | Read the page or selected text in the tab where the user starts reading, and show the highlights and playback bar there. |
| scripting | Inject the script that finds the text, highlights it and shows the playback bar, into the tab the user asked to read. |
| contextMenus | The "Read aloud selected text" item in the right-click menu. |
| storage | Save the user's settings (voice, speed, colors, languages, word replacements) and the voices and keys they added. |
| tts | Speak with the voices built into the browser and operating system. |
| offscreen | Play audio from Google Translate, cloud and Piper voices while the user is in another tab. |
| Host: translate.google.com | Turn text into speech with Google Translate voices, when the user picks one. |
| Optional host permissions (all sites) | Requested only when needed, to read a page activeTab can't reach, such as a PDF opened from a website. |
| Optional: webNavigation | Find the frame that holds the text on sites that put it in one. |

**Remote code:** No. All code, including PDF.js and the Piper voice engine, is in the package.

**Data usage:** tick **Website content**. The text the user asks to have read can be sent to an online voice service (Google Translate, or a cloud voice the user added with their own account) to produce the speech. Certify: not sold, not used for anything unrelated to the single purpose, not used for creditworthiness or lending.

## AMO notes to reviewer

```text
ReadFollow is built on Read Aloud (ken107/read-aloud, MIT); the repository keeps its full history.

Minified or generated files and their sources:
- vendor/piper/bundle.js and inference-worker.js: built from piper/ in the repository with Node 22: cd piper && npm ci && npm run build. The build writes into vendor/piper.
- vendor/piper/piper_phonemize.js/.wasm/.data and ort/ort-wasm-simd.wasm: prebuilt WebAssembly from rhasspy/piper-phonemize and onnxruntime-web 1.17.3; see vendor/piper/THIRD-PARTY-NOTICES.txt.
- vendor/pdfjs: the PDF.js 6.4.299 legacy release from github.com/mozilla/pdf.js, unchanged apart from one script tag in web/viewer.html and one regular expression in web/viewer.mjs rewritten without the v flag so addons-linter can parse it. node tools/update-pdfjs.mjs regenerates it from the release zip.
- js/jquery-3.7.1.min.js, js/rxjs.umd.min.js and js/aws-sdk.js: unmodified library builds.
The Firefox package is generated from the Chrome sources with: node tools/build-firefox.mjs

How to test: select text on any page and press Alt+O (or right-click > Read aloud selected text). The sentence and the current word are highlighted and a playback bar appears. With an online voice, Firefox shows "Allow ReadFollow to play audio?" in the player tab once. PDFs: open any PDF and click the toolbar button.
```

## AMO product page fields

Filled in the Developer Hub by hand after the first submission; CI only sends what is in `amo-metadata.json`.

- Support email: dorzairidev@gmail.com. Support site: https://github.com/MashdorDev/readfollow/issues
- Homepage: https://github.com/MashdorDev/readfollow
- Contributions URL: https://github.com/sponsors/MashdorDev
- Tags: `scholar` only. AMO picks from a fixed list and nothing else in it describes the add-on.
- Icon `img/icon.png`, the four screenshots with the captions above, and the privacy policy in its own Developer Hub section.
- Developer comments:

```text
Online voices send the text you ask to have read to that voice's service. Voices on your computer and Piper voices stay on your device. The first time an online voice plays, Firefox may ask "Allow ReadFollow to play audio?" in the player tab. Bugs and requests: https://github.com/MashdorDev/readfollow/issues
```

## Submission checklist

- [x] Search the Chrome Web Store for "ReadFollow" by hand: the name should be free
- [x] Chrome: create the item by uploading `npm run package` output by hand, which gives the item ID CI needs (`pipjjjdajcbfjbnmpnhlfkmlopmbbgkk`, 2026-10-10)
- [x] Chrome: fill the store listing, privacy practices and distribution tabs from this file
- [x] AMO: submit 1.0.0 as a listed add-on with the source archive and the notes above (CI, 2026-10-10)
- [x] AMO: fill the product page fields above
- [x] Add the AMO secrets and `CWS_EXTENSION_ID` to this repository
- [ ] Add `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET` and `CWS_REFRESH_TOKEN` before the next version
- [ ] After approval: add the ReadFollow card to Window Fullscreen for YouTube and the store links to the README (`docs/plan.md` step 6)
