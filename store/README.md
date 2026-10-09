# Store assets

Chrome Web Store sizes: four screenshots at 1280x800 and the small promo tile at 440x280. The 128px store icon is `img/icon.png` (96px artwork, 16px transparent padding). AMO accepts the same screenshots.

Each screenshot is a real capture of the extension, taken in Chrome for Testing at 1280x800, placed in `src/screenshot.html` with one caption (`?img=...&caption=...`, plus `&popup=...` for the popup shot). The promo tile is `src/promo-tile.html`. Both were rendered to PNG through the DevTools protocol at device scale 1.

| File | Shows |
|---|---|
| screenshot-1-web.png | A Wikipedia selection being read: sentence in blue, word in amber, the bar at the bottom |
| screenshot-2-pdf.png | The same highlighting on an arXiv PDF in the bundled viewer |
| screenshot-3-popup.png | The popup with the follow-along text, over the page being read |
| screenshot-4-settings.png | Settings in dark mode with the highlight color choices |

The pages shown are Wikipedia's "Speech synthesis" article (CC BY-SA) and arXiv 1706.03762 ("Attention Is All You Need").
