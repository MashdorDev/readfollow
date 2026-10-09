//Runs inside the bundled pdf.js viewer (vendor/pdfjs/web/viewer.html) and answers the window that embeds it:
//pdf-viewer.html, or the frame js/content/pdf-doc.js lays over a PDF tab.
//Messages: loadDocument {buffer}, getCurrentIndex, getTexts {index, quietly}; replies carry the request id.

const app = window.PDFViewerApplication

//Lines at the top or bottom of a page that repeat on the next page, numbers aside, are running headers and footers
const MAX_REPEATED_LINES = 3

//Baseline drop, in text heights, beyond which the next line starts a new paragraph; body text runs about 1.1-1.2
const PARAGRAPH_GAP = 1.5

//pdf document -> page number -> lines
const pageLines = new WeakMap()

window.addEventListener("message", async event => {
  if (event.source != parent) return
  const {id, method} = event.data
  let reply
  try {
    if (method == "loadDocument") reply = {value: await loadDocument(event.data.buffer)}
    else if (method == "getCurrentIndex") reply = {value: await getCurrentIndex()}
    else if (method == "getTexts") reply = {value: await getTexts(event.data.index, event.data.quietly)}
    else return
  }
  catch (err) {
    reply = {error: err.message}
  }
  event.source.postMessage({id, ...reply}, event.origin)
})

await app.initializedPromise
parent.postMessage({method: "viewerReady"}, "*")


async function loadDocument(buffer) {
  const pagesLoaded = new Promise(f => app.eventBus.on("pagesloaded", f, {once: true}))
  await app.open({data: new Uint8Array(buffer)})
  await pagesLoaded
}

//Without a document (a local file the user hasn't picked yet), wait for one to be opened in the viewer
async function getDocument() {
  if (!app.pdfDocument) await new Promise(f => app.eventBus.on("documentloaded", f, {once: true}))
  return app.pdfDocument
}

async function getCurrentIndex() {
  await getDocument()
  return app.pdfViewer.currentPageNumber - 1
}

async function getTexts(index, quietly) {
  const pdf = await getDocument()
  if (index >= pdf.numPages) return null
  if (!quietly) app.pdfViewer.currentPageNumber = index + 1
  const pageNumber = index + 1
  const neighbor = pageNumber > 1 ? pageNumber - 1 : pageNumber + 1
  let lines = await getPageLines(pdf, pageNumber)
  if (neighbor <= pdf.numPages) lines = trimRepeatedLines(lines, await getPageLines(pdf, neighbor))
  return joinParagraphs(lines)
    //citation markers like [12] or [3, 4]
    .map(text => text.replace(/\s*\[\d+(?:[,\u2013-]\s*\d+)*\]/g, ""))
}

function getPageLines(pdf, pageNumber) {
  let pages = pageLines.get(pdf)
  if (!pages) pageLines.set(pdf, pages = new Map())
  if (!pages.has(pageNumber)) pages.set(pageNumber, readPageLines(pdf, pageNumber))
  return pages.get(pageNumber)
}

//Empty strings mark paragraph breaks: a gap wider than ordinary line spacing (headings, blank lines),
//or text continuing higher up the page (the next column)
async function readPageLines(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber)
  const {items} = await page.getTextContent()
  const lines = []
  let line = ""
  let lastY = null, lastHeight = 0
  const endLine = () => {
    if (line.trim()) lines.push(line.trim())
    line = ""
  }
  for (const item of items) {
    //marked-content items carry no text
    if (item.str == null) continue
    //zero-height items are spacers whose position says nothing about layout
    if (item.height) {
      const y = item.transform[5]
      const drop = lastY == null ? 0 : lastY - y
      //sub- and superscripts sit a little off the baseline but on the same line
      if (Math.abs(drop) > lastHeight / 2) {
        endLine()
        if (drop > lastHeight * PARAGRAPH_GAP || drop < 0) lines.push("")
      }
      lastY = y
      lastHeight = item.height
    }
    line += item.str
    if (item.hasEOL) endLine()
  }
  endLine()
  return lines
}

function trimRepeatedLines(lines, otherLines) {
  const textAt = lines.flatMap((line, i) => line ? [i] : [])
  const other = otherLines.filter(line => line)
  const same = (i, otherLine) => lines[i].replace(/\d+/g, "#") == otherLine.replace(/\d+/g, "#")
  let head = 0, tail = 0
  while (head < MAX_REPEATED_LINES && head < textAt.length && head < other.length
    && same(textAt[head], other[head])) head++
  while (tail < MAX_REPEATED_LINES && tail < textAt.length - head && tail < other.length
    && same(textAt[textAt.length - 1 - tail], other[other.length - 1 - tail])) tail++
  if (head + tail == textAt.length) return []
  return lines.slice(textAt[head], textAt[textAt.length - 1 - tail] + 1)
}

//Lines wrap mid-sentence, so a line joins the next one unless it is blank or ends a sentence
function joinParagraphs(lines) {
  const paragraphs = []
  let para = ""
  for (const line of lines) {
    if (line) {
      if (!para) para = line
      else if (/\w-$/.test(para) && /^[a-z]/.test(line)) para = para.slice(0, -1) + line
      else para += " " + line
    }
    if (para && (!line || /[.!?:]["'\u201d\u2019)]*$/.test(line))) {
      paragraphs.push(para)
      para = ""
    }
  }
  if (para) paragraphs.push(para)
  return paragraphs
}
