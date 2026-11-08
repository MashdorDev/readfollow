import config from "./config"
import type { ModelConfig, PhonemeType } from "./types"
import { PhonemizeFailure, PhonemizerError, loadPiperPhonemize, makePhonemizeRunner } from "./phonemize-runner"

export interface Phrase {
  readonly phonemes: string[]
  readonly phonemeIds: number[]
  readonly idOwners: number[]
  readonly silenceSeconds: number
}


declare function createPiperPhonemize(module: Record<string, unknown>): Promise<{
  callMain(args: string[]): number
}>

const phonemizeLocal = makePhonemizeRunner(() => loadPiperPhonemize(
  createPiperPhonemize,
  () => fetch("piper_phonemize.wasm").then(res => {
    if (!res.ok) throw new Error("Failed to load piper_phonemize.wasm, status " + res.status)
    return res.arrayBuffer()
  })
))

const unsupportedLanguages = config.unsupportedLanguages

async function batchPhonemize(texts: string[], lang: string, phonemeType: PhonemeType) {
  if (phonemeType != "espeak" || unsupportedLanguages.test(lang)) {
    throw new Error("This voice needs a phonemizer that ReadFollow doesn't include (" + phonemeType + ", " + lang + ")")
  }
  return phonemizeLocal(texts, lang)
}


export function makePhonemizer(modelConfig: ModelConfig) {
  const phonemeType = modelConfig.phoneme_type ?? config.defaults.phonemeType
  const sentenceSilenceSeconds = config.defaults.sentenceSilenceSeconds

  return {
    //A text the phonemizer can't handle comes back with no phrases, so it is skipped, and is passed to onSkip.
    //If every text in a batch fails, the phonemizer itself is broken and the reading stops.
    async batchPhonemize(texts: string[], onSkip?: (failure: PhonemizeFailure) => void): Promise<Phrase[][]> {
      const results = await batchPhonemize(texts, modelConfig.espeak.voice, phonemeType)
      const failures = results.filter(isFailure)
      if (failures.length && failures.length == results.length && results.length > 1) throw new PhonemizerError(failures[0])
      failures.forEach(failure => onSkip?.(failure))

      return results.map(result => {
        if (isFailure(result)) return []
        const sentences = result
          .map(phonemes => ({
            phonemes,
            silenceSeconds: sentenceSilenceSeconds
          }))

        //TODO: handle phoneme_silence, i.e. break sentences further into phrases to insert phoneme silence
        const phrases = sentences

        return phrases
          .filter(x => x.phonemes.length)
          .map(({phonemes, silenceSeconds}) => ({
            phonemes,
            ...toPhonemeIds(phonemes, modelConfig),
            silenceSeconds
          }))
      })
    }
  }
}


function isFailure(result: string[][] | PhonemizeFailure): result is PhonemizeFailure {
  return !Array.isArray(result)
}


//produced by Codex from Piper's python code

const PINYIN_GROUP_END_PHONEMES = new Set([
  // tones
  "1", "2", "3", "4", "5",

  // long pauses
  "。", ".", "？", "?", "！", "!",

  // short pauses
  "—", "…", "、", "，", ",", "：", ":", "；", ";",

  // space
  " ",
])

//Also returns which phoneme each id belongs to (-1 for the start and end markers); a pad after a phoneme counts as
//part of it, so the alignment of a phoneme covers the pause that follows it
function toPhonemeIds(phonemes: readonly string[], modelConfig: ModelConfig): {phonemeIds: number[], idOwners: number[]} {
  if (!modelConfig.phoneme_id_map) throw new Error("Missing modelConfig.phoneme_id_map")

  const {bos, eos, pad, addBos, addEos, interspersePad} = config.phonemeIdConfig
  const missing = new Set<string>()
  const phonemeIds = [] as number[]
  const idOwners = [] as number[]
  let owner = -1
  const idMap = modelConfig.phoneme_id_map

  const pushMapped = (phoneme: string): boolean => {
    const ids = idMap[phoneme]
    if (!ids) {
      missing.add(phoneme)
      return false
    }

    phonemeIds.push(...ids)
    for (const _ of ids) idOwners.push(owner)
    return true
  }

  if (modelConfig.phoneme_type === "pinyin") {
    if (addBos) pushMapped(bos)

    for (const [index, phoneme] of phonemes.entries()) {
      owner = index
      if (pushMapped(phoneme) && PINYIN_GROUP_END_PHONEMES.has(phoneme)) {
        pushMapped(pad)
      }
    }

    owner = -1
    if (addEos) pushMapped(eos)
  }
  else {
    if (addBos) {
      pushMapped(bos)
      if (interspersePad) pushMapped(pad)
    }

    for (const [index, phoneme] of phonemes.entries()) {
      owner = index
      if (pushMapped(phoneme) && interspersePad) {
        pushMapped(pad)
      }
    }

    owner = -1
    if (addEos) pushMapped(eos)
  }

  if (missing.size) console.warn("Missing mapping for phonemes", missing)
  return {phonemeIds, idOwners}
}
