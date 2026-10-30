# Privacy Policy: ReadFollow

_Last updated: 30 October 2026_

ReadFollow ("the extension") is a free, open-source browser extension that reads text aloud and highlights each word on the page as it is spoken.

## Summary

ReadFollow has no account, no analytics and no advertising. Error reports are off unless you turn them on, and until then the developer receives nothing from it. Your settings stay in your browser. The only time text leaves your device is when you choose a voice that runs online: then the text you asked to have read goes to that voice's service, and nowhere else.

## The text you read

What happens to the text depends on the voice:

- **Voices built into your computer or browser that run on the device** (for example the Microsoft voices on Windows) and **Piper voices**, which you download and which run inside the extension: the text never leaves your device.
- **Google Translate voices**: the text is sent to Google Translate (`translate.google.com`) to turn it into speech. Google's handling of it is covered by Google's privacy policy.
- **Online voices built into your browser**, such as Chrome's "Google" voices: the browser itself sends the text to its provider. ReadFollow has no part in that transfer.
- **Cloud voices you add yourself with your own account** (OpenAI or an OpenAI-compatible service you set up, Microsoft Azure, Amazon Polly, IBM Watson): the text is sent to that provider, using the key you entered. Their privacy policies apply.

Only the text you asked to have read is sent: your selection, the page you started reading, or the PDF. It is sent at the moment it is read, one passage at a time.

**Auto select** uses a voice on your device when one matches the language. When none does, it can fall back to an online Google voice. Settings shows, under the voice choice, which service receives the text for the voice you picked.

## What the extension stores

Everything is stored with the browser's `storage.local`, so it stays in the browser where you set it and is never sent to the developer:

- your settings: voice, speed, pitch, volume, languages, the voice to use for each language, highlight colors, follow-along view size and placement, word replacements, and a few playback options;
- keys and addresses for cloud voices you added yourself (Amazon Polly, Microsoft Azure, IBM Watson, an OpenAI-compatible service), so they can be used when you pick those voices;
- the list of Piper voices you installed, and the voice files themselves, kept in the browser's storage for the extension;
- the names of websites where you moved the playback bar (where you left it) or hid it, so it appears the same way next time. Up to 100 sites are kept for the bar position;
- short-lived playback details, such as which tab is being read, and a temporary Google Translate session value that expires after an hour.

Removing the extension deletes all of it.

## Error reports (optional)

Reading can fail in ways nobody hears about, so version 1.0.5 and later can tell the developer when it does. This is off until you turn on "Send error reports" in Settings. In Firefox the browser also asks for your permission, and you can withdraw it in the add-on's settings at any time. When it is on and reading fails, a short report goes to a GlitchTip server run by the developer at `glitchtip.dorzairi.com`. GlitchTip is open-source error tracking, self-hosted on the developer's own hardware. The server sits behind Cloudflare, which carries the traffic and so handles the report and your IP address on the way through. No other company receives it.

A report contains:

- the type of error and the file and line in the extension where it happened, or a fixed error name from the extension's own list;
- for a missing voice, the language code it was looking for, such as `mt`;
- what kind of voice was in use (on the device, Piper, Google Translate or a cloud voice), not which one;
- the extension version and the browser name.

A report does **not** contain the text you read, the page or PDF address, your voice or settings, keys, or anything that identifies you. Error messages are left out unless they match a fixed list, because a message could quote what was being read. Like any request, it reaches the server with your IP address; the extension does not include it in the report.

## Network requests

The extension contacts:

- `translate.google.com`, only when a Google Translate voice is used;
- the cloud voice services above, only when you added one and picked its voice;
- `huggingface.co`, only when you install a Piper voice, to download the voice file. No text is sent;
- the address of a PDF you open in its viewer, to load it, as the page itself would;
- `glitchtip.dorzairi.com`, only if you turned on error reports and reading failed.

It makes no other requests. All of its code is in the package; it loads no remote code.

## Permissions

- **activeTab** and **scripting**: to read the page or selection when you start reading, and to show the highlights and the playback bar on it.
- **contextMenus**: the "Read aloud selected text" item in the right-click menu.
- **storage**: to save the settings described above.
- **tts** (Chrome) and **offscreen** (Chrome): to speak with the browser's own voices, and to play audio from online and Piper voices while you use other tabs.
- **Access to `translate.google.com`**: for the Google Translate voices.
- **Access to other websites** (optional, asked for only when needed): to read a page that the extension can't reach with activeTab alone, such as a PDF opened from a website.
- **webNavigation** (optional): to find the frame that holds the text on sites that put it in one.
- **Website content** (Firefox data declaration): declared because the text you read can go to an online voice, as described above.
- **Technical and interaction data** (Firefox, optional): asked for only if you turn on error reports.

## What the extension does not do

- It does not collect personal information or browsing history.
- It does not send anything to the developer unless you turn on error reports, and then only what is listed above.
- It does not track you, show ads, or sell or share data.

## Open source

Full source code: https://github.com/MashdorDev/readfollow

ReadFollow is built on Read Aloud by Hai Phan (MIT). See the repository for all credits.

## Contact

Questions: dorzairidev@gmail.com, or open an issue at https://github.com/MashdorDev/readfollow/issues.

## Changes

If this policy changes, the updated version will be posted on this page with a new date.
