pdf.js 6.4.299 viewer bundled in ReadFollow

Prebuilt generic viewer (legacy build) from https://github.com/mozilla/pdf.js/releases/download/v6.4.299/pdfjs-6.4.299-legacy-dist.zip
Apache License 2.0, Copyright Mozilla Foundation, see LICENSE.

Unchanged except: web/viewer.html loads ReadFollow's js/pdf-bridge.js, and
source maps, the debugger and the sample PDF are removed.
Regenerate with: node tools/update-pdfjs.mjs 6.4.299
