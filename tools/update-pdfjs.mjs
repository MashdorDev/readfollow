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

fs.writeFileSync(path.join(out, "README.txt"), `pdf.js ${version} viewer bundled in ReadFollow

Prebuilt generic viewer (legacy build) from ${zipUrl}
Apache License 2.0, Copyright Mozilla Foundation, see LICENSE.

Unchanged except: web/viewer.html loads ReadFollow's js/pdf-bridge.js, and
source maps, the debugger and the sample PDF are removed.
Regenerate with: node tools/update-pdfjs.mjs ${version}
`)
fs.rmSync(tmp, {recursive: true, force: true})
console.log(`pdf.js ${version} vendored into ${path.relative(root, out)}`)
