import { mkdirSync, writeFileSync, copyFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import sharp from "sharp"

const root = process.cwd()
const assetDir = join(root, "intro-site", "assets")
const sourceDir = join(assetDir, "web-remake")
const workDir = join(root, ".tmp", "musk-altman-web-remake")

mkdirSync(sourceDir, { recursive: true })
mkdirSync(workDir, { recursive: true })

const width = 720
const height = 960
const outputVersion = "v5"
const sceneSeconds = 3.8
const transitionSeconds = 0.3
const fps = 24

const sources = {
  elon: join(sourceDir, "elon.jpg"),
  sam: join(sourceDir, "sam.jpeg"),
  court: join(sourceDir, "court.jpg"),
}

function escapeText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function svgText(lines, x, y, size, color, weight = 700, lineHeight = 1.2, anchor = "start") {
  return `<text x="${x}" y="${y}" font-family="Arial Unicode MS, PingFang SC, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size * lineHeight}">${escapeText(line)}</tspan>`)
    .join("")}</text>`
}

function overlaySvg(scene) {
  const bottomLines = scene.body
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#050505" stop-opacity="0.86"/>
          <stop offset="0.38" stop-color="#050505" stop-opacity="0.25"/>
          <stop offset="1" stop-color="#050505" stop-opacity="0.94"/>
        </linearGradient>
        <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#dark)"/>
      <rect x="28" y="28" width="664" height="904" fill="none" stroke="#f5c414" stroke-width="4" opacity="0.55"/>
      <rect x="44" y="48" width="632" height="128" fill="#050505" opacity="0.84"/>
      ${svgText(["马斯克 vs 奥特曼终极审判！"], 360, 86, 34, "#f5c414", 900, 1.1, "middle")}
      ${svgText(["不要 1870 亿"], 360, 132, 50, "#f5c414", 900, 1.0, "middle")}
      ${svgText(["把 OpenAI 还给我"], 360, 174, 30, "#ffffff", 900, 1.0, "middle")}
      <rect x="52" y="198" width="616" height="58" fill="#f5c414" opacity="0.96"/>
      ${svgText([scene.kicker], 360, 236, 26, "#050505", 900, 1.0, "middle")}
      <rect x="70" y="700" width="580" height="194" fill="#050505" opacity="0.84" rx="18"/>
      <rect x="70" y="700" width="580" height="194" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.24" rx="18"/>
      ${svgText(bottomLines, 94, 750, 27, "#ffffff", 800, 1.24)}
      ${svgText([scene.tag], 92, 676, 24, "#f5c414", 900)}
      <rect x="48" y="264" width="624" height="3" fill="#ffffff" opacity="0.25"/>
      <rect x="${56 + scene.progress * 96}" y="264" width="92" height="3" fill="#f5c414" opacity="0.95"/>
      <rect x="50" y="910" width="620" height="2" fill="#f5c414" opacity="0.75"/>
    </svg>
  `)
}

function lowerThirdSvg(label, x, y) {
  return Buffer.from(`
    <svg width="230" height="62" viewBox="0 0 230 62" xmlns="http://www.w3.org/2000/svg">
      <rect width="230" height="62" rx="14" fill="#050505" fill-opacity="0.84"/>
      <rect x="2" y="2" width="226" height="58" rx="12" fill="none" stroke="#f5c414" stroke-opacity="0.7" stroke-width="2"/>
      <text x="115" y="40" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="26" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeText(label)}</text>
    </svg>
  `)
}

async function portrait(input, w, h, position = "center") {
  const rounded = Buffer.from(`<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="28" ry="28" fill="#fff"/></svg>`)
  return sharp(input)
    .rotate()
    .resize(w, h, { fit: "cover", position })
    .modulate({ saturation: 0.92, brightness: 0.82 })
    .linear(1.18, -10)
    .composite([{ input: rounded, blend: "dest-in" }])
    .png()
    .toBuffer()
}

async function sceneBase(index) {
  return sharp(sources.court)
    .resize(width, height, { fit: "cover", position: "center" })
    .blur(8)
    .modulate({ brightness: 0.45, saturation: 0.55 })
    .png()
    .toBuffer()
}

async function renderScene(scene, index) {
  const base = await sceneBase(index)
  const elon = await portrait(sources.elon, scene.portrait === "wide" ? 255 : 280, 370, "centre")
  const sam = await portrait(sources.sam, scene.portrait === "wide" ? 255 : 280, 370, "north")
  const composites = [
    { input: base, left: 0, top: 0 },
    { input: overlaySvg(scene), left: 0, top: 0 },
  ]

  if (scene.layout === "split") {
    composites.splice(1, 0,
      { input: elon, left: 74, top: 286 },
      { input: sam, left: 366, top: 286 },
      { input: lowerThirdSvg("MUSK", 0, 0), left: 94, top: 612 },
      { input: lowerThirdSvg("ALTMAN", 0, 0), left: 386, top: 612 },
    )
  } else if (scene.layout === "elon") {
    composites.splice(1, 0,
      { input: elon, left: 75, top: 292 },
      { input: Buffer.from(`<svg width="300" height="320" xmlns="http://www.w3.org/2000/svg"><rect x="16" y="16" width="268" height="288" rx="28" fill="#050505" fill-opacity="0.72" stroke="#f5c414" stroke-width="3"/><text x="150" y="86" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#f5c414" font-weight="900" font-size="42" text-anchor="middle">诉讼</text><text x="150" y="146" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#fff" font-weight="900" font-size="30" text-anchor="middle">控制权</text><text x="150" y="202" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#fff" font-weight="900" font-size="30" text-anchor="middle">公益使命</text><text x="150" y="258" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#fff" font-weight="900" font-size="30" text-anchor="middle">商业化</text></svg>`), left: 352, top: 315 },
      { input: lowerThirdSvg("马斯克方", 0, 0), left: 99, top: 625 },
    )
  } else if (scene.layout === "sam") {
    composites.splice(1, 0,
      { input: sam, left: 365, top: 292 },
      { input: Buffer.from(`<svg width="300" height="320" xmlns="http://www.w3.org/2000/svg"><rect x="16" y="16" width="268" height="288" rx="28" fill="#050505" fill-opacity="0.72" stroke="#ffffff" stroke-opacity="0.44" stroke-width="3"/><text x="150" y="90" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#fff" font-weight="900" font-size="35" text-anchor="middle">OpenAI</text><text x="150" y="154" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#f5c414" font-weight="900" font-size="31" text-anchor="middle">拒绝出售</text><text x="150" y="214" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#fff" font-weight="900" font-size="28" text-anchor="middle">反诉路线</text></svg>`), left: 64, top: 326 },
      { input: lowerThirdSvg("奥特曼方", 0, 0), left: 391, top: 625 },
    )
  } else {
    composites.splice(1, 0,
      { input: elon, left: 72, top: 294 },
      { input: sam, left: 390, top: 294 },
      { input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><line x1="360" y1="290" x2="360" y2="660" stroke="#f5c414" stroke-width="5" stroke-dasharray="16 14"/><circle cx="360" cy="480" r="70" fill="#050505" fill-opacity="0.86" stroke="#f5c414" stroke-width="4"/><text x="360" y="468" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#f5c414" font-weight="900" font-size="34" text-anchor="middle">审判</text><text x="360" y="512" font-family="Arial Unicode MS, PingFang SC, sans-serif" fill="#fff" font-weight="900" font-size="28" text-anchor="middle">升级</text></svg>`), left: 0, top: 0 },
    )
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#050505",
    },
  })
    .composite(composites)
    .png()
    .toFile(join(workDir, `scene0${index}.png`))
}

const scenes = [
  {
    layout: "split",
    progress: 0,
    kicker: "一场关于 OpenAI 未来归属的公开冲突",
    tag: "开场冲突",
    body: ["1870 亿美元收购提议被拒后，", "矛盾从估值谈判转向控制权与使命。", "问题不再是价格，而是谁能定义 OpenAI。"],
  },
  {
    layout: "elon",
    progress: 1,
    kicker: "马斯克把战场推向“使命背离”",
    tag: "马斯克视角",
    body: ["核心叙事：OpenAI 当初承诺服务公众，", "如今却越来越像封闭商业机器。", "他要的不是报价，是把方向盘夺回来。"],
  },
  {
    layout: "sam",
    progress: 2,
    kicker: "奥特曼阵营强调公司仍要继续推进",
    tag: "奥特曼视角",
    body: ["反方叙事：拒绝收购并不等于拒绝监督，", "而是防止外部压力打断研发路线。", "商业化、算力和治理被绑在同一张桌上。"],
  },
  {
    layout: "split",
    progress: 3,
    kicker: "收购、拒绝、反诉，把估值变成治理危机",
    tag: "时间线推进",
    body: ["第一幕：高价收购提议。", "第二幕：董事会拒绝。", "第三幕：诉讼叙事升级，公众开始追问规则。"],
  },
  {
    layout: "elon",
    progress: 4,
    kicker: "这场争夺真正刺痛的是 AI 权力结构",
    tag: "核心矛盾",
    body: ["当模型、算力和资本被锁在同一家公司，", "谁来监督“为了全人类”的承诺？", "这才是冲突被放大的原因。"],
  },
  {
    layout: "verdict",
    progress: 5,
    kicker: "最终问题：AI 公司到底该由谁来约束？",
    tag: "终局悬念",
    body: ["这不是普通富豪口水仗，", "而是 AI 时代的权力边界样本。", "钱、技术、公益使命，谁说了算？"],
  },
]

for (let index = 0; index < scenes.length; index += 1) {
  await renderScene(scenes[index], index + 1)
}

copyFileSync(join(workDir, "scene01.png"), join(assetDir, `musk-altman-web-remake-${outputVersion}-poster.png`))

function writeIgnitionMusic(file, seconds) {
  const sampleRate = 44100
  const channels = 2
  const totalSamples = Math.floor(sampleRate * seconds)
  const data = Buffer.alloc(totalSamples * channels * 2)
  const tempo = 150
  const beatSeconds = 60 / tempo
  const notes = [55, 55, 82.41, 73.42, 61.74, 61.74, 92.5, 82.41]

  for (let sample = 0; sample < totalSamples; sample += 1) {
    const t = sample / sampleRate
    const beat = t / beatSeconds
    const beatIndex = Math.floor(beat)
    const beatPhase = beat - beatIndex
    const barBeat = beatIndex % 4
    const note = notes[Math.floor(t / (beatSeconds * 2)) % notes.length]
    const build = Math.min(1, 0.35 + t / 9)
    const drop = t > 2.4 ? 1 : 0.55
    const fadeOut = Math.min(1, Math.max(0, (seconds - t) / 1.1))

    const kick = Math.sin(2 * Math.PI * (48 + 65 * Math.exp(-beatPhase * 18)) * t) * Math.exp(-beatPhase * 12) * (barBeat === 0 || barBeat === 2 ? 0.9 : 0.15)
    const snarePhase = (beat - Math.floor(beat / 2) * 2) - 1
    const snare = snarePhase >= 0 && snarePhase < 0.22 ? (Math.random() * 2 - 1) * Math.exp(-snarePhase * 22) * 0.34 : 0
    const hatPhase = (beat * 2) % 1
    const hat = (Math.random() * 2 - 1) * Math.exp(-hatPhase * 36) * 0.12
    const bass = Math.sign(Math.sin(2 * Math.PI * note * t)) * 0.16 * (0.75 + 0.25 * Math.sin(2 * Math.PI * beatSeconds * t)) * build
    const leadGate = beatPhase < 0.58 ? 1 : 0.18
    const lead = (
      Math.sin(2 * Math.PI * note * 2 * t) * 0.09 +
      Math.sin(2 * Math.PI * note * 3 * t) * 0.045
    ) * leadGate * build
    const riser = Math.sin(2 * Math.PI * (180 + t * 24) * t) * 0.025 * Math.min(1, t / 12)
    let value = (kick + snare + hat + bass + lead + riser) * 0.72 * drop * fadeOut
    value = Math.tanh(value * 1.45)

    const left = Math.max(-1, Math.min(1, value * (0.96 + 0.04 * Math.sin(t * 7))))
    const right = Math.max(-1, Math.min(1, value * (0.96 - 0.04 * Math.sin(t * 7))))
    data.writeInt16LE(Math.round(left * 32767), sample * 4)
    data.writeInt16LE(Math.round(right * 32767), sample * 4 + 2)
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

const musicPath = join(workDir, "ignition-original.wav")
const duration = (sceneSeconds * scenes.length) - (transitionSeconds * (scenes.length - 1))
writeIgnitionMusic(musicPath, duration + 0.2)

const tempVideo = join(workDir, "silent.mp4")
const finalVideo = join(assetDir, `musk-altman-web-remake-${outputVersion}.mp4`)
const segmentFrames = Math.round(sceneSeconds * fps)
const sceneInputs = scenes.flatMap((_, index) => ["-loop", "1", "-t", String(sceneSeconds), "-i", join(workDir, `scene0${index + 1}.png`)])
const filters = scenes
  .map((_, index) => {
    const drift = index % 2 === 0
      ? `x='iw/2-(iw/zoom/2)+sin(on/7)*7':y='ih/2-(ih/zoom/2)+cos(on/9)*7'`
      : `x='iw/2-(iw/zoom/2)-cos(on/8)*7':y='ih/2-(ih/zoom/2)-sin(on/6)*7'`
    return `[${index}:v]scale=820:1094,zoompan=z='1+0.055*on/${segmentFrames}':${drift}:d=${segmentFrames}:s=${width}x${height}:fps=${fps},drawbox=x=0:y='mod(t*420\\,${height})':w=${width}:h=2:color=white@0.10:t=fill,format=yuv420p[v${index}]`
  })
const xfadeLines = []
let previous = "v0"
for (let index = 1; index < scenes.length; index += 1) {
  const output = index === scenes.length - 1 ? "vout" : `vx${index}`
  const offset = (sceneSeconds - transitionSeconds) * index
  xfadeLines.push(`[${previous}][v${index}]xfade=transition=fadeblack:duration=${transitionSeconds}:offset=${offset.toFixed(2)}[${output}]`)
  previous = output
}
const renderVideo = spawnSync("ffmpeg", [
  "-y",
  ...sceneInputs,
  "-filter_complex",
  [...filters, ...xfadeLines].join(";"),
  "-map", "[vout]",
  "-c:v", "libx264",
  "-crf", "17",
  "-preset", "medium",
  "-pix_fmt", "yuv420p",
  tempVideo,
], { encoding: "utf8" })
if (renderVideo.status !== 0) throw new Error(renderVideo.stderr || renderVideo.stdout)

const mux = spawnSync("ffmpeg", [
  "-y",
  "-i", tempVideo,
  "-i", musicPath,
  "-shortest",
  "-af", `acompressor=threshold=-18dB:ratio=2.5:attack=8:release=90,afade=t=in:st=0:d=0.08,afade=t=out:st=${Math.max(0, duration - 0.9).toFixed(2)}:d=0.85`,
  "-c:v", "copy",
  "-c:a", "aac",
  "-b:a", "160k",
  finalVideo,
], { encoding: "utf8" })
if (mux.status !== 0) throw new Error(mux.stderr || mux.stdout)

writeFileSync(
  join(sourceDir, "sources.json"),
  `${JSON.stringify({
    generated: new Date().toISOString(),
    note: "Original remake composition. No frames, audio, or images from the user-provided reference video were used. Background music is procedurally synthesized for this delivery.",
    assets: [
      {
        file: "elon.jpg",
        source: "https://commons.wikimedia.org/wiki/File:Elon_Musk_-_March_28,_2024_(cropped).jpg",
        license: "CC BY 4.0",
        author: "Wcamp9",
      },
      {
        file: "sam.jpeg",
        source: "https://commons.wikimedia.org/wiki/File:Sam_Altman,_June_2023_(GPOABG244)_(cropped).jpeg",
        license: "CC BY-SA 3.0",
        author: "Amos Ben Gershom / Government Press Office of Israel",
      },
      {
        file: "court.jpg",
        source: "https://commons.wikimedia.org/wiki/File:Courtroom,_Byron_R._White_U.S._Courthouse_today.jpg",
        license: "Public domain / PD-USGov-GSA",
        author: "General Services Administration",
      },
    ],
  }, null, 2)}\n`,
)

console.log(`rendered ${finalVideo}`)
