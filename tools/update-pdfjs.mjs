//Vendors the legacy build of Mozilla's prebuilt pdf.js viewer into vendor/pdfjs: node tools/update-pdfjs.mjs [version]
//The modern build skips Babel and calls APIs newer than Chrome 125 without polyfills.
//Files are copied unchanged from the release zip except web/viewer.html, which gets one script tag
//that loads ReadFollow's bridge (js/pdf-bridge.js). Source maps, the debugger and the sample PDF are left out.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {execFileSync} from "node:child_process"

const version = process.argv[2] || "6.4.299"
const root = path.resolve(import.meta.dirname, "..")
const out = path.join(root, "vendor", "pdfjs")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pdfjs-"))

const zipUrl = `https://github.com/mozilla/pdf.js/releases/download/v${version}/pdfjs-${version}-legacy-dist.zip`
const res = await fetch(zipUrl)
if (!res.ok) throw new Error(`Download failed: ${res.status} ${zipUrl}`)
const zipFile = path.join(tmp, "pdfjs.zip")
fs.writeFileSync(zipFile, Buffer.from(await res.arrayBuffer()))
const unpacked = path.join(tmp, "dist")
fs.mkdirSync(unpacked)
//Windows ships bsdtar, which reads zip; the GNU tar that Git Bash puts first on PATH doesn't
if (process.platform == "win32") execFileSync(path.join(process.env.SystemRoot, "System32", "tar.exe"), ["-xf", zipFile, "-C", unpacked])
else execFileSync("unzip", ["-q", zipFile, "-d", unpacked])

const skip = new Set(["debugger.css", "debugger.mjs", "compressed.tracemonkey-pldi-09.pdf"])
fs.rmSync(out, {recursive: true, force: true})
for (const dir of ["build", "web"]) {
  fs.cpSync(path.join(unpacked, dir), path.join(out, dir), {
    recursive: true,
    filter: src => !src.endsWith(".map") && !skip.has(path.basename(src)),
  })
}
fs.copyFileSync(path.join(unpacked, "LICENSE"), path.join(out, "LICENSE"))

const viewerHtml = path.join(out, "web", "viewer.html")
const html = fs.readFileSync(viewerHtml, "utf8")
const viewerScript = '<script src="viewer.mjs" type="module"></script>'
if (!html.includes(viewerScript)) throw new Error("viewer.html layout changed, can't add the bridge script")
fs.writeFileSync(viewerHtml, html.replace(viewerScript, viewerScript + '\n  <script src="../../../js/pdf-bridge.js" type="module"></script>'))

//addons.mozilla.org rejects files its linter can't parse, and it can't parse the v flag (set subtraction) in the
//viewer's link finder. The same expression with lookaheads and the u flag matches identically.
const viewerMjs = path.join(out, "web", "viewer.mjs")
const autolinkV = String.raw`/\b(?:https?:\/\/|mailto:|www\.)(?:[\S--[\p{P}<>]]|\/|[\S--[\[\]]]+[\S--[\p{P}<>]])+|(?=\p{L})[\S--[@\p{Ps}\p{Pe}<>]]{1,64}@([\S--[[\p{P}--\-]<>]]{1,63}(?:\.[\S--[[\p{P}--\-]<>]]{1,63})+)/gv`
const autolinkU = String.raw`/\b(?:https?:\/\/|mailto:|www\.)(?:(?![\p{P}<>])\S|\/|[^\s\[\]]+(?![\p{P}<>])\S)+|(?=\p{L})(?:(?![@\p{Ps}\p{Pe}<>])\S){1,64}@((?:-|(?![\p{P}<>])\S){1,63}(?:\.(?:-|(?![\p{P}<>])\S){1,63})+)/gu`
const viewerCode = fs.readFileSync(viewerMjs, "utf8")
if (!viewerCode.includes(autolinkV)) throw new Error("viewer.mjs link finder changed, check whether it still needs rewriting for addons-linter")
let viewerPatched = viewerCode.replace(autolinkV, autolinkU)

//PDF scripting runs form JavaScript in pdf.sandbox.mjs, which carries a second webpack bundle inside one string
//literal. ReadFollow only reads PDFs aloud, so scripting is turned off and the sandbox isn't shipped.
const scriptingOn = '["enableScripting", {\n  value: true,'
if (!viewerPatched.includes(scriptingOn)) throw new Error("viewer.mjs enableScripting default changed")
viewerPatched = viewerPatched.replace(scriptingOn, '["enableScripting", {\n  value: false,')
fs.writeFileSync(viewerMjs, viewerPatched)
//quickjs-eval is the interpreter only the sandbox loads. The nowasm fallbacks are wasm2js copies of the image
//decoders, each a base64 blob on one line, loaded only when WebAssembly fails; the manifest allows
//wasm-unsafe-eval, so the .wasm decoders always load.
for (const file of ["build/pdf.sandbox.mjs", "web/wasm/quickjs-eval.js", "web/wasm/quickjs-eval.wasm",
  "web/wasm/jbig2_nowasm_fallback.js", "web/wasm/openjpeg_nowasm_fallback.js"]) {
  fs.rmSync(path.join(out, file))
}

//The Chrome Web Store flags core-js's old IE Object.create fallback (it builds a <script> tag from pieces to
//get a null-prototype object out of an ActiveX document or an iframe) as obfuscated code. Every browser
//ReadFollow supports has a native Object.create, so the fallback is never reached; replace it with the native one.
const objectCreateFallback = /\/\* global ActiveXObject -- old IE, WSH \*\/\n([\s\S]*?\n)var GT = '>';\nvar LT = '<';[\s\S]*?\nmodule\.exports = Object\.create \|\| function create\(O, Properties\) \{[\s\S]*?\n\};\n/
const objectCreateNative = `$1var IE_PROTO = sharedKey('IE_PROTO');
hiddenKeys[IE_PROTO] = true;

// \`Object.create\` method
// https://tc39.es/ecma262/#sec-object.create
// ReadFollow: native in every supported browser, the old IE fallback is removed
module.exports = Object.create;
`
for (const file of ["web/viewer.mjs", "build/pdf.mjs", "build/pdf.worker.mjs"]) {
  const full = path.join(out, file)
  const code = fs.readFileSync(full, "utf8")
  if (!objectCreateFallback.test(code)) throw new Error(`${file}: core-js object-create layout changed`)
  const patched = code.replace(objectCreateFallback, objectCreateNative)
  if (/ActiveXObject|LT \+ SCRIPT/.test(patched)) throw new Error(`${file}: old IE script-tag code is still present`)
  fs.writeFileSync(full, patched)
}

fs.writeFileSync(path.join(out, "README.txt"), `pdf.js ${version} viewer bundled in ReadFollow

Prebuilt generic viewer (legacy build) from ${zipUrl}
Apache License 2.0, Copyright Mozilla Foundation, see LICENSE.

Unchanged except: web/viewer.html loads ReadFollow's js/pdf-bridge.js, one regular
expression in web/viewer.mjs is rewritten without the v flag (addons-linter can't
parse it; it matches the same text), core-js's old IE Object.create fallback is
replaced with the native Object.create in viewer.mjs, pdf.mjs and pdf.worker.mjs,
PDF scripting is off by default and build/pdf.sandbox.mjs and web/wasm/quickjs-eval.*
are removed, the web/wasm/*_nowasm_fallback.js decoders are removed, and
source maps, the debugger and the sample PDF are removed.
Regenerate with: node tools/update-pdfjs.mjs ${version}
`)
fs.rmSync(tmp, {recursive: true, force: true})
console.log(`pdf.js ${version} vendored into ${path.relative(root, out)}`)
