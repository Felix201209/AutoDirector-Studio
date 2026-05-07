#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { createDecipheriv } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const CORE_KEY = Buffer.from("687a4852416d736f356b496e62617857", "hex")
const META_KEY = Buffer.from("2331346c6a6b5f215c5d2630553c2728", "hex")
const NCM_HEADER = "CTENFDAM"
const META_PREFIX = "163 key(Don't modify):"

class NcmCliError extends Error {
  constructor(code, message) {
    super(message)
    this.name = "NcmCliError"
    this.code = code
  }
}

function cliError(code, message) {
  return new NcmCliError(code, message)
}

function usage() {
  console.log(`Usage:
  node scripts/ncm-to-mp3.mjs <file-or-dir...> [options]

Options:
  -o, --output <file>       Output file. Only valid with one input file.
  -d, --out-dir <dir>       Output directory for converted files.
  -r, --recursive           Convert .ncm files inside input directories recursively.
  --keep-original-format    Write the decrypted original stream format instead of forcing MP3.
  --overwrite               Replace existing output files.
  --dry-run                 Resolve inputs and output paths without writing files.
  --json                    Print one machine-readable JSON summary to stdout.
  --ndjson                  Print one JSON object per event to stdout.
  --manifest <file>         Write the JSON summary to a file.
  --fail-fast               Stop after the first failed input.
  --no-metadata             Do not write ID3 metadata while transcoding with ffmpeg.
  -h, --help                Show this help.

Examples:
  npm run ncm -- song.ncm
  npm run ncm -- ./music --recursive --out-dir ./converted
  npm run ncm -- song.ncm -o song.mp3 --overwrite
  npm run ncm -- ./music --recursive --dry-run --json`)
}

function parseArgs(argv) {
  const options = {
    inputs: [],
    output: null,
    outDir: null,
    recursive: false,
    keepOriginalFormat: false,
    overwrite: false,
    metadata: true,
    dryRun: false,
    outputMode: "human",
    manifest: null,
    failFast: false,
  }

  function readOptionValue(index, name) {
    const value = argv[index + 1]
    if (!value || value.startsWith("-")) {
      throw cliError("MISSING_OPTION_VALUE", `Missing value for ${name}`)
    }
    return value
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "-h" || arg === "--help") {
      options.help = true
    } else if (arg === "-o" || arg === "--output") {
      options.output = readOptionValue(i, arg)
      i += 1
    } else if (arg === "-d" || arg === "--out-dir") {
      options.outDir = readOptionValue(i, arg)
      i += 1
    } else if (arg === "-r" || arg === "--recursive") {
      options.recursive = true
    } else if (arg === "--keep-original-format") {
      options.keepOriginalFormat = true
    } else if (arg === "--overwrite") {
      options.overwrite = true
    } else if (arg === "--dry-run") {
      options.dryRun = true
    } else if (arg === "--json") {
      options.outputMode = "json"
    } else if (arg === "--ndjson") {
      options.outputMode = "ndjson"
    } else if (arg === "--manifest") {
      options.manifest = readOptionValue(i, arg)
      i += 1
    } else if (arg === "--fail-fast") {
      options.failFast = true
    } else if (arg === "--no-metadata") {
      options.metadata = false
    } else if (arg.startsWith("-")) {
      throw cliError("UNKNOWN_OPTION", `Unknown option: ${arg}`)
    } else {
      options.inputs.push(arg)
    }
  }

  if (options.output && options.inputs.length !== 1) {
    throw cliError("INVALID_ARGUMENTS", "--output can only be used with exactly one input")
  }
  if (argv.includes("--json") && argv.includes("--ndjson")) {
    throw cliError("INVALID_ARGUMENTS", "--json and --ndjson cannot be used together")
  }

  return options
}

function decryptAesEcb(buffer, key) {
  const decipher = createDecipheriv("aes-128-ecb", key, null)
  decipher.setAutoPadding(true)
  return Buffer.concat([decipher.update(buffer), decipher.final()])
}

function readUInt32LE(buffer, offset, label) {
  if (offset + 4 > buffer.length) throw cliError("INVALID_NCM", `Invalid NCM file: missing ${label}`)
  return buffer.readUInt32LE(offset)
}

function buildKeyBox(keyData) {
  const box = Array.from({ length: 256 }, (_, index) => index)
  let j = 0

  for (let i = 0; i < 256; i += 1) {
    j = (j + box[i] + keyData[i % keyData.length]) & 0xff
    ;[box[i], box[j]] = [box[j], box[i]]
  }

  return box
}

function decryptAudioData(encrypted, keyBox) {
  const output = Buffer.allocUnsafe(encrypted.length)

  for (let i = 0; i < encrypted.length; i += 1) {
    const n = (i + 1) & 0xff
    const keyIndex = (keyBox[n] + keyBox[(keyBox[n] + n) & 0xff]) & 0xff
    output[i] = encrypted[i] ^ keyBox[keyIndex]
  }

  return output
}

function parseMetadata(metaBuffer) {
  if (metaBuffer.length === 0) return null

  try {
    const xored = Buffer.from(metaBuffer).map((byte) => byte ^ 0x63)
    const encoded = xored.toString("utf8")
    const base64 = encoded.startsWith(META_PREFIX) ? encoded.slice(META_PREFIX.length) : encoded
    const decrypted = decryptAesEcb(Buffer.from(base64, "base64"), META_KEY).toString("utf8")
    const jsonStart = decrypted.indexOf("{")
    if (jsonStart === -1) return null
    return JSON.parse(decrypted.slice(jsonStart))
  } catch {
    return null
  }
}

function detectAudioFormat(audio, metadata) {
  if (audio.subarray(0, 3).toString("latin1") === "ID3") return "mp3"
  if (audio.length > 2 && audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0) return "mp3"
  if (audio.subarray(0, 4).toString("latin1") === "fLaC") return "flac"
  if (audio.subarray(0, 4).toString("latin1") === "OggS") return "ogg"
  if (audio.subarray(0, 4).toString("latin1") === "RIFF" && audio.subarray(8, 12).toString("latin1") === "WAVE") {
    return "wav"
  }

  const format = typeof metadata?.format === "string" ? metadata.format.toLowerCase() : ""
  return format || "bin"
}

function decryptNcmFile(inputPath) {
  const buffer = readFileSync(inputPath)
  if (buffer.subarray(0, 8).toString("latin1") !== NCM_HEADER) {
    throw cliError("INVALID_NCM", "Invalid NCM file: bad header")
  }

  let offset = 10
  const keyLength = readUInt32LE(buffer, offset, "key length")
  offset += 4

  if (offset + keyLength > buffer.length) throw cliError("INVALID_NCM", "Invalid NCM file: truncated key data")
  const encryptedKey = Buffer.from(buffer.subarray(offset, offset + keyLength)).map((byte) => byte ^ 0x64)
  offset += keyLength

  const keyPlain = decryptAesEcb(encryptedKey, CORE_KEY)
  const keyData = keyPlain.subarray("neteasecloudmusic".length)
  if (keyData.length === 0) throw cliError("INVALID_NCM", "Invalid NCM file: empty stream key")

  const keyBox = buildKeyBox(keyData)
  const metaLength = readUInt32LE(buffer, offset, "metadata length")
  offset += 4

  if (offset + metaLength > buffer.length) throw cliError("INVALID_NCM", "Invalid NCM file: truncated metadata")
  const metadata = parseMetadata(buffer.subarray(offset, offset + metaLength))
  offset += metaLength

  offset += 4
  const coverLength = readUInt32LE(buffer, offset, "cover length")
  offset += 4 + coverLength
  if (offset > buffer.length) throw cliError("INVALID_NCM", "Invalid NCM file: truncated cover data")

  const audio = decryptAudioData(buffer.subarray(offset), keyBox)
  return {
    audio,
    metadata,
    format: detectAudioFormat(audio, metadata),
  }
}

function sanitizeName(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
}

function basenameWithoutNcm(inputPath) {
  const name = inputPath.split(/[\\/]/).pop() || "output"
  return name.toLowerCase().endsWith(".ncm") ? name.slice(0, -4) : name.replace(/\.[^.]+$/, "")
}

function outputBaseName(inputPath, metadata) {
  const title = sanitizeName(metadata?.musicName)
  const artists = Array.isArray(metadata?.artist)
    ? metadata.artist.map((artist) => sanitizeName(Array.isArray(artist) ? artist[0] : artist)).filter(Boolean)
    : []

  if (title && artists.length) return `${artists.join(", ")} - ${title}`
  if (title) return title
  return sanitizeName(basenameWithoutNcm(inputPath)) || "output"
}

function ensureCanWrite(path, overwrite) {
  if (existsSync(path) && !overwrite) {
    throw cliError("OUTPUT_EXISTS", `Output already exists: ${path}. Use --overwrite to replace it.`)
  }
  mkdirSync(dirname(path), { recursive: true })
}

function hasFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" })
  return result.status === 0
}

function ffmpegMetadataArgs(metadata) {
  if (!metadata) return []

  const args = []
  if (metadata.musicName) args.push("-metadata", `title=${metadata.musicName}`)
  if (Array.isArray(metadata.artist) && metadata.artist.length) {
    const artists = metadata.artist.map((artist) => (Array.isArray(artist) ? artist[0] : artist)).filter(Boolean)
    if (artists.length) args.push("-metadata", `artist=${artists.join("; ")}`)
  }
  if (metadata.album) args.push("-metadata", `album=${metadata.album}`)
  return args
}

function transcodeToMp3(tempPath, outputPath, metadata, writeMetadata) {
  if (!hasFfmpeg()) {
    throw cliError("FFMPEG_MISSING", "This NCM contains non-MP3 audio. Install ffmpeg or use --keep-original-format.")
  }

  const args = [
    "-y",
    "-i",
    tempPath,
    "-vn",
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "2",
    ...(writeMetadata ? ffmpegMetadataArgs(metadata) : []),
    outputPath,
  ]
  const result = spawnSync("ffmpeg", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (result.status !== 0) {
    throw cliError("FFMPEG_FAILED", result.stderr || result.stdout || "ffmpeg failed")
  }
}

function normalizeMetadata(metadata) {
  if (!metadata) return null

  const artists = Array.isArray(metadata.artist)
    ? metadata.artist.map((artist) => (Array.isArray(artist) ? artist[0] : artist)).filter(Boolean)
    : []

  return {
    title: metadata.musicName || null,
    artists,
    album: metadata.album || null,
    format: metadata.format || null,
    raw: metadata,
  }
}

function planFile(inputPath, options) {
  const resolvedInput = resolve(inputPath)
  const { audio, metadata, format } = decryptNcmFile(resolvedInput)
  const targetFormat = options.keepOriginalFormat ? format : "mp3"
  const baseName = outputBaseName(resolvedInput, metadata)
  const outputPath = resolve(
    options.output ||
      join(options.outDir ? resolve(options.outDir) : dirname(resolvedInput), `${baseName}.${targetFormat}`)
  )
  const outputExists = existsSync(outputPath)
  const needsTranscode = targetFormat !== format

  return {
    status: "planned",
    inputPath: resolvedInput,
    outputPath,
    sourceFormat: format,
    targetFormat,
    action: needsTranscode ? "transcode" : "decrypt",
    dryRun: Boolean(options.dryRun),
    outputExists,
    overwrite: Boolean(options.overwrite),
    ffmpegRequired: needsTranscode && targetFormat === "mp3",
    ffmpegAvailable: needsTranscode && targetFormat === "mp3" ? hasFfmpeg() : null,
    audioBytes: audio.length,
    metadata: normalizeMetadata(metadata),
    audio,
    rawMetadata: metadata,
  }
}

function publicResult(result) {
  const { audio, rawMetadata, ...rest } = result
  void audio
  void rawMetadata
  return rest
}

function convertFile(inputPath, options) {
  const plan = planFile(inputPath, options)

  if (options.dryRun) {
    return publicResult(plan)
  }

  ensureCanWrite(plan.outputPath, options.overwrite)

  if (plan.targetFormat === plan.sourceFormat) {
    writeFileSync(plan.outputPath, plan.audio)
  } else if (plan.targetFormat === "mp3") {
    const tempPath = join(dirname(plan.outputPath), `.${outputBaseName(plan.inputPath, plan.rawMetadata)}.${plan.sourceFormat}.tmp`)
    writeFileSync(tempPath, plan.audio)
    try {
      transcodeToMp3(tempPath, plan.outputPath, plan.rawMetadata, options.metadata)
    } finally {
      if (existsSync(tempPath)) rmSync(tempPath)
    }
  } else {
    throw cliError("UNSUPPORTED_TARGET", `Unsupported target format: ${plan.targetFormat}`)
  }

  return {
    ...publicResult(plan),
    status: "ok",
    dryRun: false,
  }
}

function expandInputs(inputs, recursive) {
  const files = []

  function walk(dirPath) {
    for (const entry of readdirSync(dirPath)) {
      const child = join(dirPath, entry)
      const stat = statSync(child)
      if (stat.isDirectory()) {
        if (recursive) walk(child)
      } else if (entry.toLowerCase().endsWith(".ncm")) {
        files.push(child)
      }
    }
  }

  for (const input of inputs) {
    const resolved = resolve(input)
    const stat = statSync(resolved)
    if (stat.isDirectory()) {
      walk(resolved)
    } else {
      files.push(resolved)
    }
  }

  return files
}

function errorResult(error, inputPath = null) {
  return {
    status: "error",
    inputPath: inputPath ? resolve(inputPath) : null,
    code: error?.code || "CONVERSION_FAILED",
    message: error?.message || String(error),
  }
}

function summarize(results, options, startedAt) {
  const ok = results.filter((result) => result.status === "ok" || result.status === "planned").length
  const failed = results.filter((result) => result.status === "error").length

  return {
    tool: "ncm-to-mp3",
    version: 1,
    dryRun: Boolean(options.dryRun),
    startedAt,
    finishedAt: new Date().toISOString(),
    ok,
    failed,
    total: results.length,
    results,
  }
}

function writeJsonLine(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function emitHumanResult(result) {
  if (result.status === "error") {
    console.error(`ERR ${result.inputPath || ""}: [${result.code}] ${result.message}`)
    return
  }

  const note = result.sourceFormat === result.targetFormat ? result.targetFormat : `${result.sourceFormat} -> ${result.targetFormat}`
  const label = result.status === "planned" ? "PLAN" : "OK  "
  console.log(`${label} ${result.inputPath} -> ${result.outputPath} (${note})`)
}

function runBatch(files, options) {
  const results = []

  for (const file of files) {
    try {
      const result = convertFile(file, options)
      results.push(result)
      if (options.outputMode === "ndjson") writeJsonLine({ event: "result", ...result })
      if (options.outputMode === "human") emitHumanResult(result)
    } catch (error) {
      const result = errorResult(error, file)
      results.push(result)
      if (options.outputMode === "ndjson") writeJsonLine({ event: "result", ...result })
      if (options.outputMode === "human") emitHumanResult(result)
      if (options.failFast) break
    }
  }

  return results
}

function main() {
  const argv = process.argv.slice(2)
  const requestedJson = argv.includes("--json")
  const requestedNdjson = argv.includes("--ndjson")
  let options

  try {
    options = parseArgs(argv)
  } catch (error) {
    const result = errorResult(error)
    if (requestedJson) {
      writeJsonLine({
        tool: "ncm-to-mp3",
        version: 1,
        dryRun: argv.includes("--dry-run"),
        ok: 0,
        failed: 1,
        total: 1,
        results: [result],
      })
    } else if (requestedNdjson) {
      writeJsonLine({ event: "result", ...result })
    } else {
      console.error(`[${result.code}] ${result.message}`)
    }
    process.exit(2)
  }

  if (options.help || options.inputs.length === 0) {
    usage()
    process.exit(options.help ? 0 : 1)
  }

  const startedAt = new Date().toISOString()
  let files
  try {
    files = expandInputs(options.inputs, options.recursive)
    if (files.length === 0) throw cliError("NO_INPUT_FILES", "No .ncm files found")
    if (options.output && files.length !== 1) {
      throw cliError("INVALID_ARGUMENTS", "--output can only be used with one resolved input file")
    }
  } catch (error) {
    const summary = summarize([errorResult(error)], options, startedAt)
    if (options.outputMode === "json") writeJsonLine(summary)
    else if (options.outputMode === "ndjson") writeJsonLine({ event: "summary", ...summary })
    else console.error(`[${summary.results[0].code}] ${summary.results[0].message}`)
    process.exit(2)
  }

  const results = runBatch(files, options)
  const summary = summarize(results, options, startedAt)

  if (options.manifest) {
    const manifestPath = resolve(options.manifest)
    mkdirSync(dirname(manifestPath), { recursive: true })
    writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`)
  }

  if (options.outputMode === "json") {
    writeJsonLine(summary)
  } else if (options.outputMode === "ndjson") {
    writeJsonLine({ event: "summary", ...summary })
  }

  if (summary.failed > 0) process.exit(1)
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  try {
    main()
  } catch (error) {
    console.error(`[${error.code || "UNEXPECTED_ERROR"}] ${error.message}`)
    process.exit(1)
  }
}

export { convertFile, decryptNcmFile, planFile }
