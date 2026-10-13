import * as rxjs from "rxjs"
import config from "./config"
import { Phrase } from "./phonemizer"
import { makeSynthesizer } from "./synthesizer"
import { PcmData, PlayAudio } from "./types"
import { immediate, lazy, makeBatchProcessor, wait } from "./utils"

interface SpeakOptions {
  readonly speakerId: number|undefined,
  readonly text: string,
  playAudio: PlayAudio
}

type Synthesizer = ReturnType<typeof makeSynthesizer>

interface MyPhrase extends Phrase {
  getPcmData(): Promise<PcmData>
}

interface Sentence {
  readonly text: string
  readonly startIndex: number
  readonly endIndex: number
  getPhrases(): Promise<MyPhrase[]>
}

type PlaybackState = rxjs.Observable<"paused"|"resumed">

//Where a phrase sits in its sentence (by phonemes) and how long its audio is, so the caller can follow along
export interface PhraseTiming {
  readonly sentenceStartIndex: number
  readonly phonemeOffset: number
  readonly phonemeCount: number
  readonly phonemeTotal: number
  readonly seconds: number
  //When the voice reports alignment: where each word of the phrase starts in its audio, numbering words from the
  //start of the sentence, and how many words the sentence has, so the caller can check they match its own text
  readonly words?: ReadonlyArray<{readonly index: number, readonly seconds: number}>
  readonly sentenceWordCount?: number
}

//A sentence, and optionally a word in it to start from. The word is used only when the voice reads the sentence
//as textWordCount words, so a word counted in the caller's text is the same word here.
export interface SeekTarget {
  readonly index: number
  readonly wordIndex?: number
  readonly textWordCount?: number
}

interface Callbacks {
  onSentence(startIndex: number, endIndex: number): void
  onPhrase?(timing: PhraseTiming): void
}

interface Playing {
  readonly completePromise: Promise<void|boolean>
  pause(): void
  resume(): void
  cancel(): void
  isPaused(): boolean
}


export function makeSpeech(
  synth: Synthesizer,
  opts: SpeakOptions,
  callbacks: Callbacks
) {
  const sentences = makeSentences(synth, opts)
  const playlist = makePlaylist(sentences, opts, callbacks)
  const control = new rxjs.Subject<"pause"|"resume"|"next"|"forward"|"rewind"|SeekTarget>()
  return {
    sentenceStartIndicies: sentences.map(sentence => sentence.startIndex),
    play: lazy(() => new Promise<void>((fulfill, reject) => {
      control
        .pipe(
          rxjs.startWith("next" as const),
          rxjs.scan((current: Playing, cmd) => {
            switch (cmd) {
              case "pause": current.pause(); return current
              case "resume": current.resume(); return current
              case "next": return playlist.next()
              case "forward": return playlist.forward(current.isPaused()) ?? current
              case "rewind": return playlist.rewind(current.isPaused()) ?? current
              default: return playlist.seek(cmd, current.isPaused()) ?? current
            }
          }, null!),
          rxjs.distinctUntilChanged(),
          rxjs.switchMap(current => {
            return rxjs.from(current.completePromise)
              .pipe(
                rxjs.finalize(() => current.cancel())
              )
          })
        )
        .subscribe({
          next(isDone) {
            if (isDone) control.complete()
            else control.next("next")
          },
          complete: fulfill,
          error: reject
        })
    })),
    pause() {
      control.next("pause")
    },
    resume() {
      control.next("resume")
    },
    cancel() {
      control.error({name: "CancellationException", message: "Playback cancelled"})
    },
    forward() {
      control.next("forward")
    },
    rewind() {
      control.next("rewind")
    },
    seek(target: SeekTarget) {
      control.next(target)
    }
  }
}


function makePlaylist(
  sentences: Sentence[],
  opts: SpeakOptions,
  callbacks: Callbacks
) {
  let sentenceIndex = 0
  let phraseIndex = -1

  return {
    next(): Playing {
      return makePlaying(async playbackState => {
        const phrases = await sentences[sentenceIndex].getPhrases()
        await wait(playbackState, "resumed")

        if (phraseIndex + 1 < phrases.length) {
          //advance to next phrase in current sentence
          phraseIndex++
          if (phraseIndex == 0) callbacks.onSentence(sentences[sentenceIndex].startIndex, sentences[sentenceIndex].endIndex)
          await playPhrase(opts, sentences, sentenceIndex, phraseIndex, playbackState, callbacks)
        }
        else if (sentenceIndex + 1 < sentences.length) {
          //advance to next sentence
          sentenceIndex++
          phraseIndex = 0
          callbacks.onSentence(sentences[sentenceIndex].startIndex, sentences[sentenceIndex].endIndex)
          await playPhrase(opts, sentences, sentenceIndex, phraseIndex, playbackState, callbacks)
        }
        else {
          //end of playlist
          return true
        }
      })
    },

    forward(isPaused: boolean): Playing|undefined {
      if (sentenceIndex + 1 < sentences.length) {
        return makePlaying(async playbackState => {
          //advance to next sentence
          sentenceIndex++
          phraseIndex = 0
          callbacks.onSentence(sentences[sentenceIndex].startIndex, sentences[sentenceIndex].endIndex)
          await new Promise<void>(f => setTimeout(f, 750))
          await wait(playbackState, "resumed")
          await playPhrase(opts, sentences, sentenceIndex, phraseIndex, playbackState, callbacks)
        }, isPaused)
      }
    },

    rewind(isPaused: boolean): Playing|undefined {
      if (sentenceIndex > 0) {
        return makePlaying(async playbackState => {
          //rewind to previous sentence
          sentenceIndex--
          phraseIndex = 0
          callbacks.onSentence(sentences[sentenceIndex].startIndex, sentences[sentenceIndex].endIndex)
          await new Promise<void>(f => setTimeout(f, 750))
          await wait(playbackState, "resumed")
          await playPhrase(opts, sentences, sentenceIndex, phraseIndex, playbackState, callbacks)
        }, isPaused)
      }
    },

    seek({index, wordIndex, textWordCount}: SeekTarget, isPaused: boolean): Playing|undefined {
      if (index >= 0 && index < sentences.length) {
        return makePlaying(async playbackState => {
          sentenceIndex = index
          phraseIndex = 0
          callbacks.onSentence(sentences[sentenceIndex].startIndex, sentences[sentenceIndex].endIndex)
          let startPhoneme = 0
          if (wordIndex) {
            const phrases = await sentences[sentenceIndex].getPhrases()
            const words = phrases.map(phrase => findWordStarts(phrase.phonemes))
            if (words.flat().length == textWordCount) {
              let before = 0
              while (phraseIndex < phrases.length - 1 && before + words[phraseIndex].length <= wordIndex) before += words[phraseIndex++].length
              startPhoneme = words[phraseIndex][wordIndex - before] ?? 0
            }
          }
          await playPhrase(opts, sentences, sentenceIndex, phraseIndex, playbackState, callbacks, startPhoneme)
        }, isPaused)
      }
    }
  }
}


function makeSentences(
  synth: Synthesizer,
  opts: SpeakOptions
) {
  /**
   * Hebrew       ׃
   * East Asian   。．
   * Burmese      ။
   * Tibetan      །
   * Arabic       ۔؟
   * Dravidian    ।॥
   */
  const tokens = opts.text.split(/([.?!۔؟]\s+|[\n׃。．။།।॥]\s*)/)

  const sentences = []
  for (let i = 0; i < tokens.length; i += 2) {
    if (/\b(\w|[A-Z][a-z]|Dept|[Ee]tc|Gov|Inc|Ltd|Mrs|Rev|Sra|vs)\.\s+$/.test(sentences[sentences.length-1]))
      sentences[sentences.length-1] += tokens[i] + (tokens[i+1] ?? '')
    else
      sentences.push(tokens[i] + (tokens[i+1] ?? ''))
  }

  const indices = [0]
  for (let i = 0; i < sentences.length; i++)
    indices.push(indices[i] + sentences[i].length)

  const batchPhonemize = makeBatchProcessor(config.phonemizeBatchSize, async (sentences: string[]) => {
    const phonemizer = await synth.phonemizerPromise
    return phonemizer.batchPhonemize(sentences)
  })

  return sentences.map<Sentence>((text, i) => {
    const phonemize = batchPhonemize.add(text, text.length)
    return {
      text,
      startIndex: indices[i],
      endIndex: indices[i+1],
      getPhrases: lazy(async () => {
        const phrases = await phonemize()
        return phrases.map<MyPhrase>((phrase, index) => ({
          phonemeIds: phrase.phonemeIds,
          idOwners: phrase.idOwners,
          phonemes: phrase.phonemes,
          silenceSeconds: index == phrases.length-1 && /\n\s*$/.test(text) ? config.paragraphSilenceSeconds : phrase.silenceSeconds,
          getPcmData: lazy(() => synth.synthesize(phrase, opts.speakerId))
        }))
      })
    }
  })
}


function makePlaying(
  synthesizeAndPlay: (playbackState: PlaybackState) => Promise<void|boolean>,
  isPaused = false
): Playing {
  const playbackState = new rxjs.BehaviorSubject<"paused"|"resumed">(isPaused ? "paused" : "resumed")
  return {
    completePromise: synthesizeAndPlay(playbackState.asObservable()),
    pause() {
      playbackState.next("paused")
    },
    resume() {
      playbackState.next("resumed")
    },
    cancel() {
      playbackState.error({name: "CancellationException", message: "Playback cancelled"})
    },
    isPaused() {
      return playbackState.getValue() == "paused"
    }
  }
}


async function playPhrase(
  opts: SpeakOptions,
  sentences: Sentence[],
  sentenceIndex: number,
  phraseIndex: number,
  playbackState: PlaybackState,
  callbacks: Callbacks,
  startPhoneme = 0
) {
  prefetch(sentences, sentenceIndex, phraseIndex, playbackState)
    .catch(err => err.name != "CancellationException" && console.error(err))

  const phrases = await sentences[sentenceIndex].getPhrases()
  await wait(playbackState, "resumed")

  if (phraseIndex < phrases.length) {
    const phrase = phrases[phraseIndex]
    const fullPcm = await phrase.getPcmData()
    await wait(playbackState, "resumed")

    //where each phoneme starts in the audio, in samples per channel
    const phonemeStarts = immediate(() => {
      if (!fullPcm.idSamples || fullPcm.idSamples.length != phrase.idOwners.length) return null
      const starts: number[] = []
      let sample = 0
      phrase.idOwners.forEach((owner, i) => {
        if (owner >= 0 && starts[owner] == null) starts[owner] = sample
        sample += fullPcm.idSamples![i]
      })
      //a phoneme the voice has no id for takes no time, so it starts where the next one does
      for (let i = phrase.phonemes.length - 1; i >= 0; i--) starts[i] ??= starts[i + 1] ?? sample
      return starts
    })
    //a seek to a word starts the audio there; without alignment it starts at the phrase
    const skipPhonemes = phonemeStarts?.[startPhoneme] != null ? startPhoneme : 0
    const skipSamples = skipPhonemes ? phonemeStarts![skipPhonemes] : 0
    const pcmData = skipSamples ? {...fullPcm, samples: fullPcm.samples.subarray(skipSamples * fullPcm.numChannels)} : fullPcm
    const secondsOf = (samples: number) => samples / fullPcm.sampleRate

    const countPhonemes = (list: MyPhrase[]) => list.reduce((sum, phrase) => sum + phrase.phonemes.length, 0)
    const wordsBefore = phrases.slice(0, phraseIndex).reduce((sum, phrase) => sum + findWordStarts(phrase.phonemes).length, 0)
    callbacks.onPhrase?.({
      sentenceStartIndex: sentences[sentenceIndex].startIndex,
      phonemeOffset: countPhonemes(phrases.slice(0, phraseIndex)) + skipPhonemes,
      phonemeCount: phrase.phonemes.length - skipPhonemes,
      phonemeTotal: countPhonemes(phrases),
      seconds: pcmData.samples.length / (pcmData.sampleRate * pcmData.numChannels) + phrase.silenceSeconds,
      ...(phonemeStarts && {
        words: findWordStarts(phrase.phonemes)
          .map((phoneme, i) => ({index: wordsBefore + i, seconds: secondsOf(phonemeStarts[phoneme] - skipSamples)}))
          .filter(word => word.seconds >= 0),
        sentenceWordCount: phrases.reduce((sum, phrase) => sum + findWordStarts(phrase.phonemes).length, 0),
      }),
    })
    let playing = opts.playAudio(pcmData, phrase.silenceSeconds)
    try {
      while (await Promise.race([wait(playbackState, "paused"), playing.completePromise]) == "paused") {
        const paused = playing.pause()
        await wait(playbackState, "resumed")
        playing = paused.resume()
      }
    }
    finally {
      playing.pause()
    }
  }
}


//The phoneme each word starts at. Words are space-separated groups that hold a letter, which in IPA includes
//the stress marks; a group of punctuation alone (a dash between spaces) isn't a word in the text either.
export function findWordStarts(phonemes: readonly string[]): number[] {
  const starts: number[] = []
  let groupStart = -1
  let hasLetter = false
  for (let i = 0; i <= phonemes.length; i++) {
    if (i == phonemes.length || /\s/.test(phonemes[i])) {
      if (groupStart >= 0 && hasLetter) starts.push(groupStart)
      groupStart = -1
      hasLetter = false
    }
    else {
      if (groupStart < 0) groupStart = i
      if (/\p{L}/u.test(phonemes[i])) hasLetter = true
    }
  }
  return starts
}


async function prefetch(
  sentences: Sentence[],
  sentenceIndex: number,
  phraseIndex: number,
  playbackState: PlaybackState
) {
  let numPhonemesToPrefetch = config.numPhonemesToPrefetch

  //get the phrases of the current sentence
  let phrases = await sentences[sentenceIndex].getPhrases()
  await wait(playbackState, "resumed")

  if (phraseIndex < phrases.length) {
    //wait until the current phrase has been synthesized before prefetching
    await phrases[phraseIndex].getPcmData()
    await wait(playbackState, "resumed")
  }

  while (numPhonemesToPrefetch > 0) {
    if (phraseIndex + 1 < phrases.length) {
      //advance to the next phrase in the current sentence
      phraseIndex++
    }
    else if (sentenceIndex + 1 < sentences.length) {
      //advance to the next sentence
      sentenceIndex++
      phraseIndex = 0

      //get the phrases
      phrases = await sentences[sentenceIndex].getPhrases()
      await wait(playbackState, "resumed")
    }
    else {
      break
    }

    if (phraseIndex < phrases.length) {
      //prefetch the phrase
      await phrases[phraseIndex].getPcmData()
      await wait(playbackState, "resumed")

      numPhonemesToPrefetch -= phrases[phraseIndex].phonemes.length
    }
  }
}
