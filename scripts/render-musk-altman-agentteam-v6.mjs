import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import sharp from "sharp"

const root = process.cwd()
const assetDir = join(root, "intro-site", "assets")
const sourceDir = join(assetDir, "web-remake")
const workDir = join(root, ".tmp", "musk-altman-agentteam-v6")
const frameDir = join(workDir, "frames")

rmSync(workDir, { recursive: true, force: true })
mkdirSync(frameDir, { recursive: true })

const W = 720
const H = 960
const FPS = 24
const DURATION = 8.625
const FRAMES = Math.round(DURATION * FPS)
const outputName = "musk-altman-agentteam-v6"

const assets = {
  elon: join(sourceDir, "elon.jpg"),
  sam: join(sourceDir, "sam.jpeg"),
  court: join(sourceDir, "court.jpg"),
}

const beats = [
  { label: "开庭", title: "马斯克", sub: "把矛盾推上台面", side: "left", stamp: "01" },
  { label: "拒绝", title: "1870亿", sub: "不是终点，是导火索", side: "center", stamp: "02" },
  { label: "反击", title: "奥特曼", sub: "OpenAI 不交方向盘", side: "right", stamp: "03" },
  { label: "焦点", title: "公益使命", sub: "谁来定义最初承诺", side: "left", stamp: "04" },
  { label: "升级", title: "控制权", sub: "估值变成治理战争", side: "split", stamp: "05" },
  { label: "质问", title: "OpenAI", sub: "商业化能否被约束", side: "right", stamp: "06" },
  { label: "拉扯", title: "资本 算力", sub: "和公共叙事绑在一起", side: "center", stamp: "07" },
  { label: "终局", title: "谁说了算？", sub: "AI 公司的权力边界", side: "split", stamp: "08" },
  { label: "结论", title: "不只是口水仗", sub: "这是 AI 治理样本", side: "center", stamp: "09" },
]

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - clamp(t), 3)
}

function pulse(t) {
  return Math.sin(t * Math.PI * 2)
}

function seededNoise(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

async function portrait(path, width, height, position) {
  const mask = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#fff"/>
    </svg>`)
  return sharp(path)
    .rotate()
    .resize(width, height, { fit: "cover", position })
    .modulate({ saturation: 0.88, brightness: 0.78 })
    .linear(1.16, -8)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer()
}

const courtBase = await sharp(assets.court)
  .resize(W, H, { fit: "cover" })
  .blur(9)
  .modulate({ saturation: 0.42, brightness: 0.38 })
  .png()
  .toBuffer()

const elonTall = await portrait(assets.elon, 310, 430, "centre")
const samTall = await portrait(assets.sam, 310, 430, "north")

function overlaySvg({ frame, beat, local, beatIndex }) {
  const flash = local < 0.14 ? 1 - local / 0.14 : 0
  const inEase = easeOutCubic(local / 0.36)
  const shake = (seededNoise(frame) - 0.5) * (local < 0.18 ? 14 : 3)
  const titleY = 108 + (1 - inEase) * 42 + pulse(local * 3) * 3
  const bigScale = 1 + flash * 0.12
  const barW = 70 + 560 * ((beatIndex + local) / beats.length)
  const diagonal = 150 + pulse(frame / 31) * 26
  const scan = (frame * 17) % H
  const warningOpacity = beatIndex % 2 === 0 ? 0.9 : 0.64
  const labelX = beat.side === "right" ? 452 : beat.side === "left" ? 64 : 94

  return Buffer.from(`
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vignette" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#050505" stop-opacity="0.72"/>
          <stop offset="0.48" stop-color="#050505" stop-opacity="0.08"/>
          <stop offset="1" stop-color="#050505" stop-opacity="0.92"/>
        </linearGradient>
        <linearGradient id="gold" x1="0" x2="1">
          <stop offset="0" stop-color="#f7c81e"/>
          <stop offset="1" stop-color="#fff1a6"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#vignette)"/>
      <path d="M -40 ${diagonal} L ${W + 60} ${diagonal - 220} L ${W + 60} ${diagonal - 170} L -40 ${diagonal + 50} Z" fill="#f7c81e" opacity="${0.08 + flash * 0.18}"/>
      <path d="M -40 ${diagonal + 420} L ${W + 60} ${diagonal + 200} L ${W + 60} ${diagonal + 232} L -40 ${diagonal + 452} Z" fill="#ffffff" opacity="0.08"/>
      <rect x="30" y="30" width="660" height="900" fill="none" stroke="#f7c81e" stroke-width="3" opacity="0.72"/>
      <rect x="46" y="46" width="628" height="72" fill="#050505" opacity="0.84"/>
      <text x="64" y="92" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="29" font-weight="900" fill="#ffffff">马斯克 vs 奥特曼</text>
      <text x="650" y="92" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#f7c81e" text-anchor="end">OPENAI</text>
      <rect x="48" y="132" width="624" height="5" fill="#ffffff" opacity="0.18"/>
      <rect x="48" y="132" width="${barW}" height="5" fill="url(#gold)"/>
      <text x="${labelX}" y="190" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="35" font-weight="900" fill="#050505">${esc(beat.label)}</text>
      <rect x="${labelX - 20}" y="150" width="190" height="58" rx="8" fill="#f7c81e" opacity="${warningOpacity}"/>
      <text x="${labelX}" y="190" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="35" font-weight="900" fill="#050505">${esc(beat.label)}</text>
      <g transform="translate(${shake},0) scale(${bigScale})">
        <text x="360" y="${titleY + 12}" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="${beat.title.length > 5 ? 54 : 72}" font-weight="950" fill="#f7c81e" text-anchor="middle" stroke="#050505" stroke-width="5" paint-order="stroke">${esc(beat.title)}</text>
        <text x="360" y="${titleY + 78}" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="31" font-weight="900" fill="#ffffff" text-anchor="middle" stroke="#050505" stroke-width="4" paint-order="stroke">${esc(beat.sub)}</text>
      </g>
      <rect x="64" y="716" width="592" height="128" rx="16" fill="#050505" opacity="0.86"/>
      <rect x="64" y="716" width="592" height="128" rx="16" fill="none" stroke="#ffffff" stroke-opacity="0.24"/>
      <text x="92" y="764" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="27" font-weight="900" fill="#ffffff">不是复制样片，是按它的冲突节奏重做。</text>
      <text x="92" y="808" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="25" font-weight="820" fill="#f7c81e">公开素材 · 原创合成 · 逐帧生成</text>
      <text x="620" y="828" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="46" font-weight="950" fill="#ffffff" opacity="0.9" text-anchor="end">${beat.stamp}</text>
      <rect x="0" y="${scan}" width="${W}" height="3" fill="#ffffff" opacity="0.14"/>
      <rect width="${W}" height="${H}" fill="#ffffff" opacity="${flash * 0.16}"/>
    </svg>`)
}

function portraitPlacement(beat, local) {
  const e = easeOutCubic(local / 0.32)
  const shove = (1 - e) * 120
  if (beat.side === "left") {
    return [
      { which: "elon", left: 70 - shove, top: 288 },
      { which: "sam", left: 435 + shove * 0.35, top: 330, dim: true },
    ]
  }
  if (beat.side === "right") {
    return [
      { which: "elon", left: -10 - shove * 0.35, top: 330, dim: true },
      { which: "sam", left: 340 + shove, top: 288 },
    ]
  }
  if (beat.side === "split") {
    return [
      { which: "elon", left: 56 - shove * 0.45, top: 300 },
      { which: "sam", left: 354 + shove * 0.45, top: 300 },
    ]
  }
  return [
    { which: "elon", left: 62 - shove * 0.3, top: 318 },
    { which: "sam", left: 352 + shove * 0.3, top: 318 },
  ]
}

async function dimPortrait(input) {
  return sharp(input)
    .modulate({ brightness: 0.48, saturation: 0.45 })
    .png()
    .toBuffer()
}

const elonDim = await dimPortrait(elonTall)
const samDim = await dimPortrait(samTall)

for (let frame = 0; frame < FRAMES; frame += 1) {
  const t = frame / FPS
  const beatFloat = (t / DURATION) * beats.length
  const beatIndex = Math.min(beats.length - 1, Math.floor(beatFloat))
  const local = beatFloat - beatIndex
  const beat = beats[beatIndex]
  const placements = portraitPlacement(beat, local)
  const composites = [
    { input: courtBase, left: 0, top: 0 },
    ...placements.map((p) => ({
      input: p.which === "elon" ? (p.dim ? elonDim : elonTall) : (p.dim ? samDim : samTall),
      left: Math.round(p.left),
      top: Math.round(p.top),
    })),
    {
      input: Buffer.from(`
        <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <line x1="360" y1="250" x2="360" y2="690" stroke="#f7c81e" stroke-width="5" stroke-dasharray="18 14" opacity="${beat.side === "split" || beat.side === "center" ? 0.8 : 0.25}"/>
          <circle cx="360" cy="500" r="${48 + 12 * pulse(local)}" fill="#050505" opacity="0.86" stroke="#f7c81e" stroke-width="4"/>
          <text x="360" y="510" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="32" font-weight="950" fill="#f7c81e" text-anchor="middle">VS</text>
        </svg>`),
      left: 0,
      top: 0,
    },
    { input: overlaySvg({ frame, beat, local, beatIndex }), left: 0, top: 0 },
  ]

  await sharp({ create: { width: W, height: H, channels: 4, background: "#050505" } })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toFile(join(frameDir, `frame_${String(frame).padStart(4, "0")}.jpg`))
}

function writeAudio(file, seconds) {
  const sampleRate = 48000
  const channels = 2
  const total = Math.floor(sampleRate * seconds)
  const data = Buffer.alloc(total * channels * 2)
  const bpm = 168
  const beatDur = 60 / bpm
  const bassNotes = [55, 65.41, 61.74, 73.42, 55, 82.41, 73.42, 61.74]
  for (let i = 0; i < total; i += 1) {
    const t = i / sampleRate
    const b = t / beatDur
    const phase = b - Math.floor(b)
    const step = Math.floor(b)
    const note = bassNotes[Math.floor(t / (beatDur * 2)) % bassNotes.length]
    const fade = Math.min(1, t / 0.25, (seconds - t) / 0.55)
    const kick = Math.sin(2 * Math.PI * (44 + 90 * Math.exp(-phase * 20)) * t) * Math.exp(-phase * 13) * (step % 2 === 0 ? 0.95 : 0.22)
    const snarePhase = ((b + 1) % 2)
    const snare = snarePhase < 0.22 ? (seededNoise(i) * 2 - 1) * Math.exp(-snarePhase * 18) * 0.38 : 0
    const hatPhase = (b * 4) % 1
    const hat = (seededNoise(i * 3) * 2 - 1) * Math.exp(-hatPhase * 48) * 0.11
    const bass = Math.tanh(Math.sin(2 * Math.PI * note * t) * 2.4) * 0.24 * (phase < 0.68 ? 1 : 0.25)
    const siren = Math.sin(2 * Math.PI * (330 + 80 * Math.sin(t * 3.7)) * t) * 0.035
    const hit = Math.exp(-((t % 0.96) / 0.09)) * Math.sin(2 * Math.PI * 920 * t) * 0.06
    let value = Math.tanh((kick + snare + hat + bass + siren + hit) * 1.25) * fade
    const pan = Math.sin(t * 5)
    data.writeInt16LE(Math.round(clamp(value * (0.92 + pan * 0.06), -1, 1) * 32767), i * 4)
    data.writeInt16LE(Math.round(clamp(value * (0.92 - pan * 0.06), -1, 1) * 32767), i * 4 + 2)
  }
  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * channels * 2, 28)
  header.writeUInt16LE(channels * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write("data", 36)
  header.writeUInt32LE(data.length, 40)
  writeFileSync(file, Buffer.concat([header, data]))
}

const audioPath = join(workDir, "agentteam-v6-original.wav")
writeAudio(audioPath, DURATION)

const outputVideo = join(assetDir, `${outputName}.mp4`)
const ffmpeg = spawnSync("ffmpeg", [
  "-y",
  "-framerate", String(FPS),
  "-i", join(frameDir, "frame_%04d.jpg"),
  "-i", audioPath,
  "-shortest",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  "-c:a", "aac",
  "-b:a", "160k",
  outputVideo,
], { encoding: "utf8" })

if (ffmpeg.status !== 0) throw new Error(ffmpeg.stderr || ffmpeg.stdout)

copyFileSync(join(frameDir, "frame_0024.jpg"), join(assetDir, `${outputName}-poster.jpg`))

writeFileSync(join(workDir, "README.md"), `# ${outputName}

Fresh original remake generated frame-by-frame.

- No frames from the user reference video.
- No audio from the user reference video.
- Public-source portraits/courtroom assets are used from intro-site/assets/web-remake.
- Procedural music is synthesized locally.
- Output: ${outputVideo}
`)

console.log(`rendered ${outputVideo}`)
