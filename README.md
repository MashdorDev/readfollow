<div align="center">
  <img src="img/icon.png" width="96" height="96">
  <h1>ReadFollow</h1>
  Text to speech that highlights each word on the page as it reads, so you can follow along.
</div>

## What it does

Select some text on any page and start reading (toolbar button, `Alt+O`, or right-click > read selection). While it reads:

- the text you selected is tinted, so you can see how much is left
- the current sentence is highlighted, and the word being spoken is highlighted on top of it
- a small bar at the bottom of the page gives you previous/next sentence, play/pause, speed and stop; drag it by the handle if it covers something
- clicking any word in the selection jumps reading to that word

Word-by-word highlighting needs a voice that reports word positions. The voices built into Windows, macOS and ChromeOS do; cloud voices highlight one sentence or phrase at a time.

Works in Chrome and Firefox (140 or newer).

## Install from source

**Chrome:** open `chrome://extensions`, turn on Developer mode, click "Load unpacked" and pick this folder.

**Firefox:** run `npm run build:firefox`, then load `build/firefox/manifest.json` from `about:debugging` > This Firefox > Load Temporary Add-on. A temporary add-on is removed when Firefox restarts; a permanent install needs a signed build.

## Credit

ReadFollow is based on [Read Aloud](https://github.com/ken107/read-aloud) by Hai Phan, which provides the page reading, voices and most of the extension. The original history is kept in this repository. Both are released under the MIT license, see [LICENSE](LICENSE).

ReadFollow is not affiliated with or endorsed by Read Aloud or its author.
