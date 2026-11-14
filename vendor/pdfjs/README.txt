pdf.js 6.4.299 viewer bundled in ReadFollow

Prebuilt generic viewer (legacy build) from https://github.com/mozilla/pdf.js/releases/download/v6.4.299/pdfjs-6.4.299-legacy-dist.zip
Apache License 2.0, Copyright Mozilla Foundation, see LICENSE.

Unchanged except: web/viewer.html loads ReadFollow's js/pdf-bridge.js, one regular
expression in web/viewer.mjs is rewritten without the v flag (addons-linter can't
parse it; it matches the same text), core-js's old IE Object.create fallback is
replaced with the native Object.create in viewer.mjs, pdf.mjs and pdf.worker.mjs,
PDF scripting is off by default and build/pdf.sandbox.mjs is removed, and
source maps, the debugger and the sample PDF are removed.
Regenerate with: node tools/update-pdfjs.mjs 6.4.299
