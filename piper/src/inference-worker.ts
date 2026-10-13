import * as ort from "onnxruntime-web/webgpu"
import { ModelConfig, PcmData } from "./types"
import config from "./config"
import { makeDispatcher } from "@lsdsoftware/message-dispatcher"

//A high quality voice on one wasm thread synthesizes slower than it speaks, leaving gaps between sentences.
//WebGPU keeps ahead in both browsers. Without it, wasm threads still help in Chrome; Firefox extension pages
//can't be cross-origin isolated, so onnxruntime drops to one thread there by itself.
//The runtime loads its .mjs from this folder (not a blob:), so extension pages may run its thread workers.
ort.env.wasm.wasmPaths = new URL("ort/", self.location.href).href
const executionProviders = ["webgpu", "wasm"]


class TransferableResult {
  constructor(public result: unknown, public transfer: Transferable[]) {}
}

const dispatcher = makeDispatcher("piper-worker", {makeInferenceEngine, infer, dispose})

addEventListener("message", event => {
  //console.debug(event.data)
  dispatcher.dispatch(event.data, null, res => {
    if (res.result instanceof TransferableResult) {
      const {result, transfer} = res.result
      res.result = result
      //console.debug(res, transfer)
      postMessage(res, {transfer})
    }
    else {
      //console.debug(res)
      postMessage(res)
    }
  })
})


interface Engine {
  infer(phonemeIds: readonly number[], speakerId: number|undefined): Promise<PcmData>
  dispose(): Promise<void>
}

const engines = new Map<string, Engine>()


async function makeInferenceEngine(args: Record<string, unknown>) {
  const model = args.model as Blob
  const modelConfig = args.modelConfig as ModelConfig

  const sampleRate = modelConfig.audio?.sample_rate ?? config.defaults.sampleRate
  const numChannels = config.defaults.numChannels
  const noiseScale = modelConfig.inference?.noise_scale ?? config.defaults.noiseScale
  const lengthScale = modelConfig.inference?.length_scale ?? config.defaults.lengthScale
  const noiseW = modelConfig.inference?.noise_w ?? config.defaults.noiseW

  const session = await ort.InferenceSession.create(URL.createObjectURL(model), {executionProviders})
  const engine: Engine = {
    async infer(phonemeIds, speakerId) {
      const feeds: Record<string, ort.Tensor> = {
        input: new ort.Tensor('int64', phonemeIds, [1, phonemeIds.length]),
        input_lengths: new ort.Tensor('int64', [phonemeIds.length]),
        scales: new ort.Tensor('float32', [noiseScale, lengthScale, noiseW])
      }
      if (speakerId != undefined) feeds.sid = new ort.Tensor('int64', [speakerId])
      const {output} = await session.run(feeds)
      return {
        samples: output.data as Float32Array,
        sampleRate,
        numChannels
      }
    },
    async dispose() {
      await session.release()
    }
  }

  //WebGPU compiles its shaders on the first run, about 12s in Firefox. Pay that while the voice loads,
  //not between the first and second sentence.
  const warmupIds = Object.values(modelConfig.phoneme_id_map ?? {}).flat().slice(0, config.warmupPhonemes)
  if (warmupIds.length) await engine.infer(warmupIds, session.inputNames.includes("sid") ? 0 : undefined)

  const engineId = String(Math.random())
  engines.set(engineId, engine)
  return engineId
}


async function infer(args: Record<string, unknown>) {
  const engineId = args.engineId as string
  const phonemeIds = args.phonemeIds as readonly number[]
  const speakerId = args.speakerId as number|undefined

  const engine = engines.get(engineId)
  if (!engine) throw new Error("Bad engineId")
  const pcmData = await engine.infer(phonemeIds, speakerId)
  return new TransferableResult(pcmData, [pcmData.samples.buffer])
}


async function dispose(args: Record<string, unknown>) {
  const engineId = args.engineId as string

  const engine = engines.get(engineId)
  if (!engine) throw new Error("Bad engineId")
  await engine.dispose()
}
