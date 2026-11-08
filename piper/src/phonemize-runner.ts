//Runs the espeak phonemizer (vendor/piper/piper_phonemize.js, an emscripten build of piper-phonemize) so that one
//bad input can't break the rest of the reading. No imports, so node --test can load this file directly.
//
//Each callMain copies its arguments, the whole JSON input included, onto the wasm stack and never pops them, so
//the stack ran out after about 19KB of text had been phonemized in one page and every later call trapped with
//"memory access out of bounds" (GlitchTip READFOLLOW-7). One call with more than about 24KB of input traps the
//same way. Text with a lone surrogate makes it throw a C++ exception, which reaches JS as a bare number.

export interface RawPhonemizer {
  //throws whatever the wasm throws; returns the program's exit code and what it printed
  run(texts: string[], lang: string): {exitCode: number, results: Array<{text: string, phonemes: string[][]}>}
}

export interface TextInfo {
  readonly length: number
  readonly utf8Bytes: number
  readonly words: number
  readonly longestWord: number
  readonly letters: number
  readonly marks: number
  readonly digits: number
  readonly punctuation: number
  readonly symbols: number
  readonly spaces: number
  readonly controls: number
  readonly formats: number
  readonly privateUse: number
  readonly unassigned: number
  readonly loneSurrogates: number
  readonly scripts: string[]
}

//What a report may say about a text that couldn't be phonemized: sizes and kinds of characters, never the text
export interface PhonemizeFailure {
  readonly kind: string
  readonly lang: string
  readonly text: TextInfo
}

export class PhonemizerError extends Error {
  readonly failure: PhonemizeFailure
  constructor(failure: PhonemizeFailure) {
    super("Piper phonemizer failed: " + failure.kind)
    this.failure = failure
  }
}

//Characters per callMain. Worst case a character takes 6 bytes of JSON (a control character as \u0001), so a call
//stays under 13KB, well inside the stack the build has
export const MAX_CALL_CHARS = 2000

type Factory = (overrides: Record<string, unknown>) => Promise<{callMain(args: string[]): number}>

//Instantiates the wasm itself to get at stackAlloc, which the build doesn't put on the module. With it each run puts
//the stack pointer back where it was, the cleanup the generated callMain leaves out.
export async function loadPiperPhonemize(
  createPiperPhonemize: Factory,
  getWasm: () => Promise<BufferSource>,
  overrides: Record<string, unknown> = {}
): Promise<RawPhonemizer> {
  let printed: Array<{text: string, phonemes: string[][]}> = []
  let stackAlloc: ((size: number) => number) | undefined
  let fail: (err: unknown) => void = () => {}
  const failed = new Promise<never>((_, reject) => fail = reject)

  const module = await Promise.race([
    createPiperPhonemize({
      ...overrides,
      print(output: string) {
        printed.push(JSON.parse(output))
      },
      instantiateWasm(imports: WebAssembly.Imports, receiveInstance: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void) {
        getWasm()
          .then(bytes => WebAssembly.instantiate(bytes, imports))
          .then(({instance, module}) => {
            //"B" in this build, see the exports list at the end of piper_phonemize.js (stackAlloc=De.B)
            stackAlloc = instance.exports.B as typeof stackAlloc
            receiveInstance(instance, module)
          })
          .catch(fail)
        return {}
      },
    }),
    failed,
  ])

  if (typeof stackAlloc != "function") throw new Error("Piper phonemizer build has no stackAlloc")
  const alloc = stackAlloc
  const top = alloc(0)
  if (alloc(32) != top - 32 || alloc(-32) != top) throw new Error("Piper phonemizer build has no stackAlloc")

  return {
    run(texts, lang) {
      printed = []
      const sp = alloc(0)
      try {
        const exitCode = module.callMain([
          "--espeak_data", "/espeak-ng-data",
          "--language", lang,
          "--input", JSON.stringify(texts.map(text => ({text}))),
        ])
        return {exitCode, results: printed}
      }
      finally {
        alloc(alloc(0) - sp)
      }
    }
  }
}


//A lone surrogate is never a character anyone reads (half of an emoji cut in two, usually)
export function sanitizeText(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�")
}

//Splits at spaces where it can, never inside a surrogate pair
export function splitText(text: string, maxChars = MAX_CALL_CHARS): string[] {
  const pieces: string[] = []
  let rest = text
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars)
    if (cut <= 0) {
      cut = maxChars
      if (/[\uD800-\uDBFF]/.test(rest[cut - 1])) cut--
    }
    else {
      cut++
    }
    pieces.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  pieces.push(rest)
  return pieces
}

const SCRIPTS = ["Latin", "Greek", "Cyrillic", "Armenian", "Hebrew", "Arabic", "Devanagari", "Bengali", "Tamil", "Thai",
  "Georgian", "Hangul", "Hiragana", "Katakana", "Han", "Ethiopic"]

export function describeText(text: string): TextInfo {
  const count = (re: RegExp) => (text.match(re) ?? []).length
  const words = text.split(/\s+/).filter(Boolean)
  return {
    length: text.length,
    utf8Bytes: new TextEncoder().encode(sanitizeText(text)).length,
    words: words.length,
    longestWord: words.reduce((max, word) => Math.max(max, word.length), 0),
    letters: count(/\p{L}/gu),
    marks: count(/\p{M}/gu),
    digits: count(/\p{N}/gu),
    punctuation: count(/\p{P}/gu),
    symbols: count(/\p{S}/gu),
    spaces: count(/\p{Z}|\s/gu),
    controls: count(/\p{Cc}/gu),
    formats: count(/\p{Cf}/gu),
    privateUse: count(/\p{Co}/gu),
    unassigned: count(/\p{Cn}/gu),
    loneSurrogates: count(/\p{Cs}/gu),
    scripts: SCRIPTS.filter(script => new RegExp(`\\p{Script=${script}}`, "u").test(text)),
  }
}

//The wasm's messages are fixed strings; anything else could quote the text (V8's JSON.parse errors do), so only
//the error type is kept
export function describeError(err: unknown): string {
  if (typeof err == "number") return "uncaught wasm exception"
  if (err instanceof Error) {
    if (/^(exit code -?\d+|unexpected output)$/.test(err.message)) return err.message
    const name = /^\w+$/.test(err.name) ? err.name : "Error"
    return /^[a-z ]{1,60}$/i.test(err.message) && /^(RuntimeError|InternalError|RangeError)$/.test(name) ? name + " " + err.message : name
  }
  return typeof err
}


//Phonemizes each text on its own if a batch fails, starting over with a fresh module after any failure, since a
//trap leaves the module's memory in an unknown state. A text that fails on a fresh module too comes back as a
//PhonemizeFailure, so the caller can skip it and go on.
export function makePhonemizeRunner(load: () => Promise<RawPhonemizer>) {
  let current: Promise<RawPhonemizer> | undefined

  function getModule() {
    return current ??= load().catch(err => {
      current = undefined
      throw err
    })
  }

  async function runPieces(pieces: string[], lang: string): Promise<string[][][]> {
    const phonemizer = await getModule()
    try {
      const {exitCode, results} = phonemizer.run(pieces, lang)
      if (exitCode != 0) throw new Error("exit code " + exitCode)
      if (results.length != pieces.length || results.some((x, i) => x.text != pieces[i])) throw new Error("unexpected output")
      return results.map(x => x.phonemes)
    }
    catch (err) {
      current = undefined
      throw err
    }
  }

  return async function phonemize(texts: string[], lang: string): Promise<Array<string[][] | PhonemizeFailure>> {
    const pieces = texts.map(text => splitText(sanitizeText(text)))
    const out: Array<string[][] | PhonemizeFailure | undefined> = texts.map(() => undefined)

    //texts grouped into calls of at most MAX_CALL_CHARS, a longer text in calls of its own
    let group: number[] = []
    let groupChars = 0
    const groups: number[][] = []
    texts.forEach((_, i) => {
      const chars = pieces[i].reduce((sum, piece) => sum + piece.length, 0)
      if (group.length && groupChars + chars > MAX_CALL_CHARS) {
        groups.push(group)
        group = []
        groupChars = 0
      }
      group.push(i)
      groupChars += chars
    })
    if (group.length) groups.push(group)

    async function runText(i: number) {
      const phonemes: string[][] = []
      for (const piece of pieces[i]) phonemes.push(...(await runPieces([piece], lang))[0])
      return phonemes
    }

    for (const indices of groups) {
      if (indices.length > 1) {
        try {
          const results = await runPieces(indices.map(i => pieces[i][0]), lang)
          indices.forEach((i, k) => out[i] = results[k])
          continue
        }
        catch (err) {
          console.warn("Piper phonemizer failed on a batch, retrying each text", err)
        }
      }
      for (const i of indices) {
        await getModule()  //a module that won't load is the end of the reading, not one skipped text
        try {
          out[i] = await runText(i)
        }
        catch (err) {
          out[i] = {kind: describeError(err), lang, text: describeText(texts[i])}
        }
      }
    }
    return out as Array<string[][] | PhonemizeFailure>
  }
}
