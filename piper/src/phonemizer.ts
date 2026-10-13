import config from "./config"
import type { ModelConfig, PhonemeType } from "./types"
import { lazy } from "./utils"

export interface Phrase {
  readonly phonemes: string[]
  readonly phonemeIds: number[]
  readonly idOwners: number[]
  readonly silenceSeconds: number
}


declare function createPiperPhonemize(module: {
  print(output: string): void
}): Promise<{
  callMain(args: string[]): number
}>

const getLocalPhonemizer = lazy(async () => {
  let results: Array<{text: string, phonemes: string[][]}> = []
  const piperPhonemize = await createPiperPhonemize({
    print(output) {
      results.push(JSON.parse(output))
    }
  })
  return {
    phonemize(texts: string[], lang: string) {
      results = []
      const exitCode = piperPhonemize.callMain([
        "--espeak_data", "/espeak-ng-data",
        "--language", lang,
        "--input", JSON.stringify(texts.map(text => ({text}))),
      ])
      if (exitCode != 0) throw new Error("Piper phonemizer failed with exit code " + exitCode)
      return results
    }
  }
})

const unsupportedLanguages = config.unsupportedLanguages

async function batchPhonemize(texts: string[], lang: string, phonemeType: PhonemeType) {
  if (phonemeType != "espeak" || unsupportedLanguages.test(lang)) {
    throw new Error("This voice needs a phonemizer that ReadFollow doesn't include (" + phonemeType + ", " + lang + ")")
  }
  const {phonemize} = await getLocalPhonemizer()
  return phonemize(texts, lang)
}


export function makePhonemizer(modelConfig: ModelConfig) {
  const phonemeType = modelConfig.phoneme_type ?? config.defaults.phonemeType
  const sentenceSilenceSeconds = config.defaults.sentenceSilenceSeconds

  return {
    async batchPhonemize(texts: string[]): Promise<Phrase[][]> {
      const results = await batchPhonemize(texts, modelConfig.espeak.voice, phonemeType)
      if (results.length != texts.length || results.some((x,i) => x.text != texts[i])) throw new Error("Unexpected")

      return results.map(result => {
        const sentences = result.phonemes
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
