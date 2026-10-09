# ReadFollow UI redesign plan

Written 2026-10-09. Goal: a ReadFollow that no longer looks like Read Aloud, built to what Chrome and Firefox ask of extensions and to what other TTS extensions show works. Decisions still open are marked **Open**.

## Where it starts

Every page is upstream Read Aloud's. The popup is two grey square buttons and an error line. The options page is a Bootstrap 4 form of full-width sliders, with a "Text Highlighting: Show in popup" setting left over from the old highlight window. Custom voices, languages, shortcuts, advanced options and the player page use Bootstrap 4. The Piper voice manager is its own React app with its own Bootstrap. The popup loads Roboto from fonts.googleapis.com, so every popup open makes a request to Google.

The on-page playback bar and the sentence/word highlights are ReadFollow's own and are the parts users see most.

## Hard requirements

Store rules, not preferences:

- Firefox MV3 has no `browser_style`, so every page ships its own CSS.
- No remote resources. The Google Fonts link goes; use the system font stack.
- Chrome Web Store assets: 128px icon with a 96px glyph and transparent padding that works on light and dark, a 440x280 promo tile, 1 to 5 screenshots at 1280x800 showing the real UI.
- Single purpose, no keyword stuffing (no keyword more than 5 times in the description), no incentivized reviews.
- AMO: data collection declared in the manifest (done for Firefox builds); text sent to a cloud voice only on a user action and limited to what the user asked to read. A one-time notice before the first cloud voice use covers this.

Sources for all of the above are in the research notes the plan was built from (Chrome developer docs, Chrome Web Store policies and image specs, Extension Workshop UX and policy pages, MDN). Chrome is ending the Featured badge program in 2026, so nothing here targets it.

## Shape of the new UI

**Design tokens.** One `css/tokens.css` with colors, spacing, radius, type scale and focus ring, in light and dark (`prefers-color-scheme`, plus `<meta name="color-scheme" content="light dark">`). Every page and the injected bar use the same tokens. Contrast: 4.5:1 for text, 3:1 for controls and focus rings. Targets at least 24px, transport buttons 40px or more. Logical CSS properties so RTL locales mirror.

**Popup (360px wide).** A launcher and status view, never something playback depends on, since popups close on any outside click. Big play/pause, stop, previous/next, speed, current voice, and a status line that is `aria-live`. Errors say what to do in one sentence with a button, not raw API text (today it shows "Cannot access contents of the page. Extension manifest must request permission..."). Settings link at the bottom.

**On-page bar.** Stays the main playback surface, as Speechify and Edge do it. Add: top layer through `popover="manual"` instead of a z-index race, full keyboard operation, a voice and speed flyout, a way to hide it per site, remember where it was dragged, follow the user's font size, and respect `prefers-reduced-motion` when scrolling to the current word.

**Highlights.** One default pair everywhere (PDFs already use it): pale blue sentence, amber word with an underline, so the word stands out without relying on color. A highlight color setting with checked presets.

**Options as a full tab** with a side nav: Voice and speech, Highlighting, Languages, Custom voices and API keys, Word replacements, Shortcuts, Privacy, About. Changes save instantly, with a "Preview" button next to voice and speed. Drop the leftover "Show in popup" highlighting mode. The separate custom-voices, languages, shortcuts and advanced pages fold into this one.

**Piper voices** are reached from the voice picker ("Download a natural voice that runs on your computer") and show size, progress and disk use. Restyling the bundled React app means rebuilding `vendor/piper` from `piper/`.

**First-run page** on install only: what it does in two lines, a paragraph to try right away, a pin-to-toolbar hint, the shortcuts, a privacy note. No signup, no wizard. Everything works if it is closed.

**Shortcuts.** At most four suggested. Edge uses Ctrl+Shift+U for its own Read Aloud. On install, `commands.getAll()` finds shortcuts that failed to register and the first-run page links to the browser's shortcut settings.

**Toolbar.** Keep the reading badge (added in #8). Tooltip describes the action. Firefox gets light and dark `theme_icons`. New icon that isn't Read Aloud's.

**Review prompt** later, only after several successful reads over 7 or more days, dismissible, never on first run.

## Order of work

Done as one pass (see Decided), in this order, smoke-tested in Chrome and Firefox:

1. Tokens and system font, drop Google Fonts and Bootstrap from the pages that move first.
2. Popup.
3. On-page bar (keyboard, top layer, flyout, per-site hide, saved position).
4. Highlight colors setting, same defaults on web pages and PDFs.
5. Options tab with the merged pages.
6. First-run page and shortcut check.
7. Piper manager restyle.
8. Icon, toolbar tooltip, theme icons, store screenshots.

## Decided (2026-10-09)

- **Look:** calm reader. Warm off-white and soft charcoal surfaces, one deep teal accent (#0F766E), rounded but not playful. Light #FAF8F5, dark #1E1F22.
- **Surfaces:** the on-page bar stays the main control and the popup becomes a launcher and status view. Other ways in (side panel, sidebar) can come later.
- **Rollout:** one pass across every surface in a single PR rather than eight, accepting a large review.
- **Highlights:** blue sentence and amber underlined word on web pages too, the same as PDFs. A color choice for the user comes later.
