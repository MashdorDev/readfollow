//Exposes how long each phoneme id plays, the same patch as piper1-gpl's patch_voice_with_alignment:
//the model's only Ceil node outputs w_ceil, the audio frames per phoneme id, and it becomes a graph output.
//Edits the ONNX protobuf directly (ModelProto.graph = 7, GraphProto.node = 1 and output = 12,
//NodeProto.output = 2 and op_type = 4, ValueInfoProto.name = 1), so the model file itself stays as installed.

interface Field {
  num: number
  start: number   //value start (after the tag, and after the length for length-delimited fields)
  end: number
  tagStart: number
}

export function addAlignmentOutput(bytes: Uint8Array): {bytes: Uint8Array, outputName: string} {
  const graph = Array.from(readFields(bytes, 0, bytes.length)).find(f => f.num == 7)
  if (!graph) throw new Error("No graph in model")

  const ceilOutputs: string[] = []
  const outputs: string[] = []
  for (const field of readFields(bytes, graph.start, graph.end)) {
    if (field.num == 1) {
      let opType = ""
      const nodeOutputs: string[] = []
      for (const f of readFields(bytes, field.start, field.end)) {
        if (f.num == 4) opType = readString(bytes, f)
        else if (f.num == 2) nodeOutputs.push(readString(bytes, f))
      }
      if (opType == "Ceil") ceilOutputs.push(...nodeOutputs)
    }
    else if (field.num == 12) {
      for (const f of readFields(bytes, field.start, field.end)) if (f.num == 1) outputs.push(readString(bytes, f))
    }
  }
  if (ceilOutputs.length != 1) throw new Error("Expected one Ceil node, found " + ceilOutputs.length)
  const outputName = ceilOutputs[0]
  if (outputs.includes(outputName)) return {bytes, outputName}

  const name = new TextEncoder().encode(outputName)
  const valueInfo = [0x0a, ...varint(name.length), ...name]
  const addition = Uint8Array.from([(12 << 3) | 2, ...varint(valueInfo.length), ...valueInfo])
  const graphLength = graph.end - graph.start + addition.length
  const graphTag = Uint8Array.from([(7 << 3) | 2, ...varint(graphLength)])

  const out = new Uint8Array(graph.tagStart + graphTag.length + graphLength + bytes.length - graph.end)
  let p = 0
  for (const part of [bytes.subarray(0, graph.tagStart), graphTag, bytes.subarray(graph.start, graph.end), addition, bytes.subarray(graph.end)]) {
    out.set(part, p)
    p += part.length
  }
  return {bytes: out, outputName}
}


function* readFields(b: Uint8Array, start: number, end: number): Generator<Field> {
  let p = start
  while (p < end) {
    const tagStart = p
    let tag
    [tag, p] = readVarint(b, p)
    const num = Math.floor(tag / 8)
    switch (tag & 7) {
      case 0: {
        const s = p;
        [, p] = readVarint(b, p)
        yield {num, start: s, end: p, tagStart}
        break
      }
      case 1: yield {num, start: p, end: p + 8, tagStart}; p += 8; break
      case 2: {
        let length
        [length, p] = readVarint(b, p)
        yield {num, start: p, end: p + length, tagStart}
        p += length
        break
      }
      case 5: yield {num, start: p, end: p + 4, tagStart}; p += 4; break
      default: throw new Error("Unsupported protobuf wire type " + (tag & 7))
    }
  }
}

//Lengths in a 100MB+ model pass 2^31, so this multiplies instead of shifting
function readVarint(b: Uint8Array, p: number): [number, number] {
  let value = 0
  let scale = 1
  for (;;) {
    const byte = b[p++]
    value += (byte & 0x7f) * scale
    scale *= 128
    if (byte < 0x80) return [value, p]
  }
}

function varint(value: number): number[] {
  const out: number[] = []
  while (value >= 0x80) {
    out.push((value % 128) | 0x80)
    value = Math.floor(value / 128)
  }
  out.push(value)
  return out
}

function readString(b: Uint8Array, f: Field) {
  return new TextDecoder().decode(b.subarray(f.start, f.end))
}
