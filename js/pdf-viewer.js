
const ready = new Promise(f => document.addEventListener("DOMContentLoaded", f))
  .then(loadViewer)
  .then(loadDocument)

registerMessageListener("pdfViewer", {
  getDocumentInfo: function() {
    return {
      url: location.href,
      title: document.title,
    }
  },
  getCurrentIndex: async function() {
    const queue = await ready
    const res = await queue.send({method: "getCurrentIndex"})
    return res.value
  },
  getTexts: async function(index, quietly) {
    const queue = await ready
    const res = await queue.send({method: "getTexts", index: index, quietly: quietly})
    return res.value
  }
})

bgPageInvoke("pdfViewerCheckIn")
  .catch(console.error)



async function loadViewer() {
  //Same origin as this page: config.pdfjsViewerUrl is the dynamic web-accessible URL, a different origin,
  //which this page's require-corp embedder policy refuses to frame.
  //An empty file parameter keeps pdf.js from opening its sample document.
  const viewerUrl = new URL("vendor/pdfjs/web/viewer.html?file=", location.href)
  const frame = document.getElementById("viewer-frame")
  frame.src = viewerUrl.href
  var queue
  await new Promise(f => queue = new MessageQueue(frame.contentWindow, viewerUrl.origin, {viewerReady: f}))
  return queue
}

//Without a url (a local file), the user opens the file in the viewer
async function loadDocument(queue) {
  const query = getQueryString()
  if (!query.url) return queue
  const res = await fetch(query.url)
  if (!res.ok) throw new Error("Failed to download PDF, status " + res.status)
  const buffer = await res.arrayBuffer()
  await queue.send({method: "loadDocument", buffer: buffer}, [buffer])
  return queue
}

function MessageQueue(targetWindow, targetOrigin, handlers) {
  const pending = {}
  window.addEventListener("message", event => {
    if (event.origin == targetOrigin) {
      if (handlers[event.data.method]) handlers[event.data.method](event.data)
      else if (pending[event.data.id]) pending[event.data.id](event.data)
      else console.error("Unhandled", event)
    }
  })
  this.send = function(message, transfer) {
    message.id = Math.random()
    targetWindow.postMessage(message, targetOrigin, transfer)
    return new Promise(f => pending[message.id] = f)
      .finally(() => delete pending[message.id])
      .then(res => {
        if (res.error) throw new Error(res.error)
        return res
      })
  }
}
