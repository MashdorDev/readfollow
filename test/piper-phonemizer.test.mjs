//node --test
//Runs the bundled espeak phonemizer (vendor/piper) through piper/src/phonemize-runner.ts. Before this, every
//callMain left its input on the wasm stack, and after about 19KB of text in one page Piper failed with
//"memory access out of bounds" for the rest of the page's life (GlitchTip READFOLLOW-7).

import test from "node:test"
import assert from "node:assert"
import {createRequire} from "node:module"
import {readFile} from "node:fs/promises"
import path from "node:path"
import {fileURLToPath} from "node:url"
import {
  loadPiperPhonemize, makePhonemizeRunner, splitText, sanitizeText, describeText, describeError, MAX_CALL_CHARS,
} from "../piper/src/phonemize-runner.ts"

const vendor = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vendor", "piper")
const createPiperPhonemize = createRequire(import.meta.url)(path.join(vendor, "piper_phonemize.js"))

function load() {
  return loadPiperPhonemize(
    createPiperPhonemize,
    () => readFile(path.join(vendor, "piper_phonemize.wasm")),
    {locateFile: file => path.join(vendor, file), printErr() {}}
  )
}

const SENTENCE = "The quick brown fox jumps over the lazy dog. "

test("phonemizes far more text than the wasm stack holds, on one module", async () => {
  let loads = 0
  const phonemize = makePhonemizeRunner(() => (loads++, load()))
  //900 characters a call: the leak used to trap on call 21
  for (let i = 0; i < 200; i++) {
    const [result] = await phonemize([SENTENCE.repeat(20)], "en-us")
    assert.ok(Array.isArray(result) && result.length == 20, "call " + i)
  }
  assert.equal(loads, 1)
})

test("a sentence longer than one call can take is split, not a crash", async () => {
  const phonemize = makePhonemizeRunner(load)
  const long = SENTENCE.replace(".", "").repeat(1500)  //66K characters with no sentence end
  const [result] = await phonemize([long], "en-us")
  assert.ok(Array.isArray(result) && result.flat().length > 1000)
})

test("a lone surrogate is replaced instead of throwing", async () => {
  const phonemize = makePhonemizeRunner(load)
  const results = await phonemize(["Half an emoji \ud83d here.", "And the next sentence."], "en-us")
  assert.ok(results.every(Array.isArray))
})

test("a text that still fails is skipped with a description, the others are read", async () => {
  let loads = 0
  const phonemize = makePhonemizeRunner(async () => {
    loads++
    const real = await load()
    return {
      run(texts, lang) {
        if (texts.some(text => text.includes("poison"))) throw new WebAssembly.RuntimeError("memory access out of bounds")
        return real.run(texts, lang)
      }
    }
  })
  const results = await phonemize(["Before.", "my private poison 123", "After."], "en-us")
  assert.ok(Array.isArray(results[0]) && Array.isArray(results[2]))
  assert.equal(results[1].kind, "RuntimeError memory access out of bounds")
  assert.equal(results[1].lang, "en-us")
  assert.equal(results[1].text.length, 21)
  assert.equal(results[1].text.digits, 3)
  assert.ok(!JSON.stringify(results[1]).includes("poison"))
  //the batch failure and the failed text each start a fresh module
  assert.equal(loads, 3)
})

test("a module that fails to load is tried again next time", async () => {
  let loads = 0
  const phonemize = makePhonemizeRunner(() => ++loads == 1 ? Promise.reject(new Error("offline")) : load())
  await assert.rejects(phonemize(["Hello."], "en-us"), /offline/)
  const [result] = await phonemize(["Hello."], "en-us")
  assert.ok(Array.isArray(result))
})

test("splitText keeps pieces under the limit and surrogate pairs whole", () => {
  const text = "😀".repeat(MAX_CALL_CHARS)
  const pieces = splitText(text)
  assert.equal(pieces.join(""), text)
  assert.ok(pieces.every(piece => piece.length <= MAX_CALL_CHARS && sanitizeText(piece) == piece))
  assert.deepEqual(splitText("aaa bbb ccc", 8), ["aaa bbb ", "ccc"])
})

test("describeText and describeError say nothing of the text", () => {
  const info = describeText("שלום world 42 \ud800")
  assert.deepEqual(info.scripts, ["Latin", "Hebrew"])
  assert.equal(info.loneSurrogates, 1)
  assert.equal(info.words, 4)
  assert.equal(describeError(12345), "uncaught wasm exception")
  assert.equal(describeError(new SyntaxError('Unexpected token "my secret"')), "SyntaxError")
  assert.equal(describeError(new Error("exit code 1")), "exit code 1")
})
