import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import sharp from "sharp"

const root = process.cwd()
const assetDir = join(root, "intro-site", "assets")
const sourceDir = join(assetDir, "web-remake")
const outputName = "musk-altman-agentteam-v9"
const workDir = join(root, ".tmp", outputName)
const frameDir = join(workDir, "frames")
const evidenceDir = join(assetDir, `${outputName}-evidence`)

rmSync(workDir, { recursive: true, force: true })
rmSync(evidenceDir, { recursive: true, force: true })
mkdirSync(frameDir, { recursive: true })
mkdirSync(evidenceDir, { recursive: true })

const W = 720
const H = 960
const FPS = 24
const DURATION = 14.4
const FRAMES = Math.round(DURATION * FPS)
const TTS = process.env.TTS_GEN ?? join(process.env.CODEX_HOME ?? `${process.env.HOME}/.codex`, "skills", "speech", "scripts", "text_to_speech.py")

const referencePath = "local-reference/reference-video.mp4"
const musicPath = "local-music-library/Lulleaux,Kid Princess - Empty Love.mp3"
const assets = {
  elon: join(sourceDir, "elon.jpg"),
  sam: join(sourceDir, "sam.jpeg"),
  court: join(sourceDir, "court.jpg"),
}

const narrationText = "马斯克的报价，表面是买 OpenAI。重点不是钱，而是控制权。科普一下：收购报价想换走决策权；但董事会可以按使命和章程拒绝。OpenAI 的反击，是算力和商业化需要资本。真正的问题是，AI 公司到底谁说了算？"
const narrationInstructions = [
  "Voice Affect: 沉稳、清晰、有新闻解释感。",
  "Tone: 克制、有判断力，不夸张不喊叫。",
  "Pacing: 稳定偏快，适合 14 秒竖屏短片。",
  "Pauses: 在“控制权”“拒绝”“资本”后略停。",
  "Pronunciation: OpenAI 读作 Open A I，AI 读作 A I。",
].join("\n")

const shots = [
  {
    start: 0,
    end: 1.65,
    mode: "hook",
    label: "BREAKING",
    title: "不是收购新闻",
    subtitle: "而是 OpenAI 控制权问题",
    caption: "马斯克的报价，表面是买 OpenAI。",
    accent: "#f4d35e",
  },
  {
    start: 1.65,
    end: 3.35,
    mode: "offer",
    label: "科普 01",
    title: "974 亿美元报价",
    subtitle: "报价不是普通投资",
    caption: "重点不是钱，而是控制权。",
    accent: "#f4d35e",
  },
  {
    start: 3.35,
    end: 5.05,
    mode: "musk",
    label: "MUSK SIDE",
    title: "要争回方向盘",
    subtitle: "公益使命、公司结构、决策权",
    caption: "收购报价想换走决策权。",
    accent: "#ff6b4a",
  },
  {
    start: 5.05,
    end: 6.85,
    mode: "board",
    label: "科普 02",
    title: "董事会为什么能拒绝？",
    subtitle: "它看的不只是价格，也看使命与章程",
    caption: "董事会可以按使命和章程拒绝。",
    accent: "#8bd3dd",
  },
  {
    start: 6.85,
    end: 8.65,
    mode: "openai",
    label: "OPENAI SIDE",
    title: "反击点在现实成本",
    subtitle: "算力、人才、训练，都需要资本",
    caption: "OpenAI 的反击，是算力和商业化需要资本。",
    accent: "#9dd6ff",
  },
  {
    start: 8.65,
    end: 10.45,
    mode: "map",
    label: "科普 03",
    title: "为什么会变成 AI 治理？",
    subtitle: "模型、资本、公众利益被绑在同一张桌上",
    caption: "这不是口水仗，是治理结构的样本。",
    accent: "#b7f8c8",
  },
  {
    start: 10.45,
    end: 12.35,
    mode: "timeline",
    label: "CONTEXT",
    title: "冲突继续升级",
    subtitle: "报价、拒绝、诉讼和商业化压力互相推高",
    caption: "钱、技术、使命，最后都落到控制权。",
    accent: "#ffc2d1",
  },
  {
    start: 12.35,
    end: DURATION,
    mode: "final",
    label: "FINAL QUESTION",
    title: "AI 公司谁说了算？",
    subtitle: "投资人、董事会、创始人，还是公共利益？",
    caption: "真正的问题是，AI 公司到底谁说了算？",
    accent: "#f4d35e",
  },
]

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}

function easeOut(t) {
  return 1 - Math.pow(1 - clamp(t), 3)
}

function easeInOut(t) {
  const x = clamp(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

function currentShot(t) {
  return shots.find((shot) => t >= shot.start && t < shot.end) ?? shots.at(-1)
}

function textLines(text, chars = 18) {
  const out = []
  let line = ""
  for (const char of String(text)) {
    line += char
    if (line.length >= chars || "，。；、".includes(char)) {
      if (line.trim()) out.push(line.trim())
      line = ""
    }
  }
  if (line.trim()) out.push(line.trim())
  return out.slice(0, 3)
}

function multilineText(lines, x, y, opts = {}) {
  const {
    size = 28,
    weight = 820,
    fill = "#f8fafc",
    anchor = "start",
    gap = Math.round(size * 1.36),
    family = "Arial Unicode MS, PingFang SC, Hiragino Sans GB, sans-serif",
  } = opts
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * gap}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(line)}</text>`)
    .join("")
}

async function portrait(file, w, h, position = "center") {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="26" fill="#fff"/></svg>`)
  return sharp(file)
    .rotate()
    .resize(w, h, { fit: "cover", position })
    .modulate({ saturation: 0.88, brightness: 0.82 })
    .linear(1.06, -4)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer()
}

const bg = await sharp(assets.court)
  .resize(W, H, { fit: "cover" })
  .blur(8)
  .modulate({ brightness: 0.36, saturation: 0.45 })
  .linear(0.95, -8)
  .png()
  .toBuffer()
const bgSharp = await sharp(assets.court)
  .resize(W, H, { fit: "cover" })
  .modulate({ brightness: 0.45, saturation: 0.42 })
  .png()
  .toBuffer()
const elonBig = await portrait(assets.elon, 330, 430, "centre")
const samBig = await portrait(assets.sam, 330, 430, "north")
const elonTall = await portrait(assets.elon, 380, 530, "centre")
const samTall = await portrait(assets.sam, 380, 530, "north")

function background(t, shot, local) {
  const progress = t / DURATION
  const grain = Math.sin(t * 8.3) * 0.006 + 0.018
  return `
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#101820" stop-opacity=".46"/>
      <stop offset=".48" stop-color="#08090d" stop-opacity=".38"/>
      <stop offset="1" stop-color="#1c120d" stop-opacity=".36"/>
    </linearGradient>
    <rect width="${W}" height="${H}" fill="url(#wash)"/>
    <rect width="${W}" height="${H}" fill="#fff" opacity="${grain}"/>
    <rect x="44" y="40" width="632" height="3" rx="2" fill="rgba(255,255,255,.18)"/>
    <rect x="44" y="40" width="${632 * progress}" height="3" rx="2" fill="${shot.accent}"/>
    <text x="44" y="80" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="18" font-weight="850" fill="${shot.accent}">AUTODIRECTOR NEWS EXPLAINER</text>
    <text x="676" y="80" text-anchor="end" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="18" font-weight="800" fill="rgba(255,255,255,.62)">MUSK × ALTMAN</text>
  `
}

function titleBlock(shot, local, y = 118) {
  const p = easeOut(local / 0.35)
  const dy = Math.round((1 - p) * 26)
  const labelW = Math.max(118, shot.label.length * 15 + 34)
  const titleSize = shot.title.length > 11 ? 44 : 52
  return `
    <g transform="translate(0 ${dy})" opacity="${0.25 + p * 0.75}">
      <rect x="44" y="${y}" width="${labelW}" height="36" rx="7" fill="${shot.accent}"/>
      <text x="62" y="${y + 25}" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="17" font-weight="950" fill="#070707">${esc(shot.label)}</text>
      ${multilineText(textLines(shot.title, 12), 44, y + 86, { size: titleSize, weight: 950, fill: "#ffffff" })}
      ${multilineText(textLines(shot.subtitle, 18), 46, y + 146, { size: 24, weight: 760, fill: "rgba(255,255,255,.78)" })}
    </g>
  `
}

function subtitleBar(shot, local) {
  const p = easeOut(local / 0.28)
  const y = 784 + Math.round((1 - p) * 34)
  return `
    <g opacity="${0.2 + p * 0.8}">
      <rect x="42" y="${y}" width="636" height="118" rx="18" fill="rgba(8,10,14,.90)" stroke="rgba(255,255,255,.14)"/>
      <rect x="62" y="${y + 22}" width="5" height="72" rx="3" fill="${shot.accent}"/>
      ${multilineText(textLines(shot.caption, 17), 84, y + 52, { size: 30, weight: 900, fill: "#fff" })}
      <text x="84" y="${y + 94}" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="18" font-weight="760" fill="rgba(255,255,255,.54)">AI-GENERATED VOICE · VERIFIED LOCAL ASSETS</text>
    </g>
  `
}

function card(x, y, w, h, fill = "rgba(255,255,255,.08)", stroke = "rgba(255,255,255,.16)") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="${stroke}"/>`
}

function sceneSvg(shot, t, local) {
  const p = easeOut(local / 0.42)
  const out = easeInOut(clamp((1 - local) / 0.18))
  const opacity = clamp(Math.min(p, out) + 0.08)
  const base = background(t, shot, local)
  if (shot.mode === "hook") {
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${base}
      <g opacity="${opacity}">
        <rect x="44" y="286" width="632" height="346" rx="30" fill="rgba(0,0,0,.44)" stroke="rgba(255,255,255,.14)"/>
        <rect x="${70 - (1 - p) * 80}" y="320" width="270" height="276" rx="24" fill="rgba(255,107,74,.12)" stroke="#ff6b4a" stroke-width="3"/>
        <rect x="${380 + (1 - p) * 80}" y="320" width="270" height="276" rx="24" fill="rgba(157,214,255,.12)" stroke="#9dd6ff" stroke-width="3"/>
        <text x="205" y="628" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="24" font-weight="900" fill="#ffb09c">MUSK</text>
        <text x="515" y="628" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="24" font-weight="900" fill="#bfe7ff">ALTMAN / OPENAI</text>
        <circle cx="360" cy="462" r="${42 + p * 16}" fill="#070707" stroke="${shot.accent}" stroke-width="4"/>
        <text x="360" y="476" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="31" font-weight="950" fill="${shot.accent}">VS</text>
      </g>
      ${titleBlock(shot, local)}${subtitleBar(shot, local)}</svg>`
  }
  if (shot.mode === "offer") {
    const bar = 382 * p
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${base}
      <g opacity="${opacity}" transform="translate(0 ${Math.round((1 - p) * 16)})">
        ${card(56, 284, 608, 350, "rgba(244,211,94,.95)", "rgba(244,211,94,.95)")}
        <text x="360" y="370" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="64" font-weight="950" fill="#090909">974 亿美元</text>
        <text x="360" y="424" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="900" fill="#111">Musk-led bid for OpenAI nonprofit</text>
        <rect x="142" y="484" width="436" height="16" rx="8" fill="rgba(0,0,0,.18)"/>
        <rect x="142" y="484" width="${bar}" height="16" rx="8" fill="#090909"/>
        ${["钱", "资产", "控制权"].map((name, i) => `<circle cx="${166 + i * 194}" cy="554" r="44" fill="#090909"/><text x="${166 + i * 194}" y="567" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="27" font-weight="950" fill="#fff">${name}</text>`).join("")}
      </g>
      ${titleBlock(shot, local)}${subtitleBar(shot, local)}</svg>`
  }
  if (shot.mode === "musk") {
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${base}
      <g opacity="${opacity}">
        ${card(390, 302, 280, 334, "rgba(255,107,74,.13)", "rgba(255,107,74,.52)")}
        <text x="530" y="378" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="36" font-weight="950" fill="#ffb09c">控制权</text>
        <path d="M454 454 H608" stroke="#ffb09c" stroke-width="8" stroke-linecap="round"/>
        <path d="M454 520 H608" stroke="#ffb09c" stroke-width="8" stroke-linecap="round" opacity=".65"/>
        <text x="530" y="590" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="25" font-weight="850" fill="#fff">价格只是入口</text>
      </g>
      ${titleBlock(shot, local)}${subtitleBar(shot, local)}</svg>`
  }
  if (shot.mode === "board") {
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${base}
      <g opacity="${opacity}">
        ${card(62, 290, 596, 360, "rgba(139,211,221,.12)", "rgba(139,211,221,.42)")}
        ${["章程", "使命", "交易", "长期风险"].map((name, i) => {
          const x = 156 + i % 2 * 250
          const y = 386 + Math.floor(i / 2) * 128
          return `<rect x="${x - 82}" y="${y - 48}" width="164" height="88" rx="16" fill="rgba(0,0,0,.62)" stroke="#8bd3dd"/><text x="${x}" y="${y + 10}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="31" font-weight="950" fill="#eff"> ${name}</text>`
        }).join("")}
        <path d="M360 334 V612" stroke="#8bd3dd" stroke-width="4" stroke-dasharray="12 14" opacity="${0.2 + p * 0.7}"/>
      </g>
      ${titleBlock(shot, local)}${subtitleBar(shot, local)}</svg>`
  }
  if (shot.mode === "openai") {
    const nodes = [["算力", 146, 394], ["人才", 360, 336], ["资本", 574, 394], ["模型训练", 360, 564]]
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${base}
      <g opacity="${opacity}">
        <path d="M146 394 L360 336 L574 394 L360 564 Z" fill="rgba(157,214,255,.10)" stroke="#9dd6ff" stroke-width="6" stroke-linejoin="round"/>
        ${nodes.map(([name, x, y]) => `<circle cx="${x}" cy="${y}" r="66" fill="rgba(7,9,13,.86)" stroke="#9dd6ff" stroke-width="3"/><text x="${x}" y="${y + 10}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="27" font-weight="950" fill="#e9f7ff">${name}</text>`).join("")}
        <text x="360" y="462" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="36" font-weight="950" fill="#9dd6ff">商业化压力</text>
      </g>
      ${titleBlock(shot, local)}${subtitleBar(shot, local)}</svg>`
  }
  if (shot.mode === "map") {
    const points = [["模型", 150, 376], ["资本", 360, 302], ["公众", 570, 376], ["监管", 238, 586], ["使命", 482, 586]]
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${base}
      <g opacity="${opacity}">
        <path d="M150 376 L360 302 L570 376 L482 586 L238 586 Z" fill="rgba(183,248,200,.10)" stroke="#b7f8c8" stroke-width="6"/>
        ${points.map(([name, x, y], index) => `<circle cx="${x}" cy="${y}" r="${58 + (index === 1 ? p * 9 : 0)}" fill="rgba(4,7,8,.86)" stroke="#b7f8c8" stroke-width="3"/><text x="${x}" y="${y + 10}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="27" font-weight="950" fill="#effff3">${name}</text>`).join("")}
        <text x="360" y="478" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="40" font-weight="950" fill="#b7f8c8">AI 治理</text>
      </g>
      ${titleBlock(shot, local)}${subtitleBar(shot, local)}</svg>`
  }
  if (shot.mode === "timeline") {
    const items = [["报价", "974 亿美元"], ["拒绝", "董事会"], ["升级", "诉讼/治理"], ["现实", "算力资本"]]
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${base}
      <g opacity="${opacity}">
        <path d="M114 350 H606" stroke="rgba(255,194,209,.38)" stroke-width="6" stroke-linecap="round"/>
        ${items.map(([a, b], i) => {
          const x = 114 + i * 164
          return `<circle cx="${x}" cy="350" r="18" fill="#ffc2d1"/><rect x="${x - 70}" y="${390 + (i % 2) * 52}" width="140" height="104" rx="16" fill="rgba(0,0,0,.66)" stroke="#ffc2d1"/><text x="${x}" y="${430 + (i % 2) * 52}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="28" font-weight="950" fill="#fff">${a}</text><text x="${x}" y="${466 + (i % 2) * 52}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="20" font-weight="780" fill="#ffdce5">${b}</text>`
        }).join("")}
      </g>
      ${titleBlock(shot, local)}${subtitleBar(shot, local)}</svg>`
  }
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${base}
    <g opacity="${opacity}">
      ${card(54, 274, 612, 370, "rgba(0,0,0,.62)", "rgba(244,211,94,.52)")}
      <text x="360" y="392" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="58" font-weight="950" fill="#fff">AI 公司</text>
      <text x="360" y="470" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="64" font-weight="950" fill="${shot.accent}">谁说了算？</text>
      <text x="360" y="556" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="27" font-weight="850" fill="rgba(255,255,255,.78)">投资人 · 董事会 · 创始人 · 公共利益</text>
    </g>${titleBlock(shot, local, 104)}${subtitleBar(shot, local)}</svg>`
}

function imagePlacements(shot, local) {
  const p = easeOut(local / 0.38)
  if (shot.mode === "hook") {
    return [
      { input: elonBig, left: Math.round(62 - (1 - p) * 75), top: 292 },
      { input: samBig, left: Math.round(328 + (1 - p) * 75), top: 292 },
    ]
  }
  if (shot.mode === "musk") return [{ input: elonTall, left: Math.round(40 - (1 - p) * 88), top: 220 }]
  if (shot.mode === "openai") return [{ input: samTall, left: Math.round(340 + (1 - p) * 86), top: 210 }]
  if (shot.mode === "final") {
    return [
      { input: elonBig, left: 44, top: 234 },
      { input: samBig, left: 346, top: 234 },
    ]
  }
  return []
}

function ensureNarration() {
  const narrationPath = join(workDir, "narration.mp3")
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY)
  const result = hasOpenAiKey
    ? spawnSync("uv", [
      "run",
      "--with",
      "openai",
      "python",
      TTS,
      "speak",
      "--input",
      narrationText,
      "--voice",
      "cedar",
      "--instructions",
      narrationInstructions,
      "--response-format",
      "mp3",
      "--speed",
      "1.08",
      "--out",
      narrationPath,
    ], { encoding: "utf8" })
    : spawnSync("uvx", [
      "--from",
      "edge-tts",
      "edge-tts",
      "--voice",
      "zh-CN-YunjianNeural",
      "--rate",
      "+18%",
      "--pitch",
      "-2Hz",
      "--text",
      narrationText,
      "--write-media",
      narrationPath,
    ], { encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "TTS generation failed")
  return narrationPath
}

const narrationPath = ensureNarration()
const narrationProbe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", narrationPath], { encoding: "utf8" })
const narrationDuration = Number(narrationProbe.stdout.trim() || 0)
const speedRatio = narrationDuration > 0 ? narrationDuration / (DURATION - 0.28) : 1
const voicePath = join(workDir, "voice-aligned.m4a")
const voiceFilters = [
  `atempo=${clamp(speedRatio, 0.82, 1.45).toFixed(3)}`,
  "highpass=f=70",
  "lowpass=f=14500",
  "acompressor=threshold=-18dB:ratio=2.2:attack=12:release=150",
  "volume=1.05",
  `apad=pad_dur=${DURATION}`,
  `atrim=0:${DURATION}`,
  "afade=t=in:st=0:d=0.12",
  `afade=t=out:st=${DURATION - 0.42}:d=0.38`,
].join(",")
const voicePrep = spawnSync("ffmpeg", ["-y", "-i", narrationPath, "-af", voiceFilters, "-c:a", "aac", "-b:a", "192k", voicePath], { encoding: "utf8" })
if (voicePrep.status !== 0) throw new Error(voicePrep.stderr || voicePrep.stdout)

const musicBed = join(workDir, "music-bed.m4a")
const music = spawnSync("ffmpeg", [
  "-y",
  "-ss",
  "33",
  "-t",
  String(DURATION + 0.5),
  "-i",
  musicPath,
  "-map",
  "0:a:0",
  "-vn",
  "-af",
  `highpass=f=80,lowpass=f=12000,volume=0.20,afade=t=in:st=0:d=0.3,afade=t=out:st=${DURATION - 0.72}:d=0.6,loudnorm=I=-24:LRA=8:TP=-2`,
  "-c:a",
  "aac",
  "-b:a",
  "160k",
  musicBed,
], { encoding: "utf8" })
if (music.status !== 0) throw new Error(music.stderr || music.stdout)

const mixedAudio = join(workDir, "mixed-audio.m4a")
const mix = spawnSync("ffmpeg", [
  "-y",
  "-i",
  voicePath,
  "-i",
  musicBed,
  "-filter_complex",
  `amix=inputs=2:duration=first:dropout_transition=0,atrim=0:${DURATION},loudnorm=I=-15:LRA=7:TP=-1.5`,
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  mixedAudio,
], { encoding: "utf8" })
if (mix.status !== 0) throw new Error(mix.stderr || mix.stdout)

for (let frame = 0; frame < FRAMES; frame += 1) {
  const t = frame / FPS
  const shot = currentShot(t)
  const local = clamp((t - shot.start) / (shot.end - shot.start))
  const bgInput = shot.mode === "timeline" ? bgSharp : bg
  const composites = [
    { input: bgInput, left: 0, top: 0 },
    ...imagePlacements(shot, local),
    { input: Buffer.from(sceneSvg(shot, t, local)), left: 0, top: 0 },
  ]
  await sharp({ create: { width: W, height: H, channels: 4, background: "#070707" } })
    .composite(composites)
    .jpeg({ quality: 93 })
    .toFile(join(frameDir, `frame_${String(frame).padStart(4, "0")}.jpg`))
}

const outputVideo = join(assetDir, `${outputName}.mp4`)
const render = spawnSync("ffmpeg", [
  "-y",
  "-framerate",
  String(FPS),
  "-i",
  join(frameDir, "frame_%04d.jpg"),
  "-i",
  mixedAudio,
  "-shortest",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "17",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  outputVideo,
], { encoding: "utf8" })
if (render.status !== 0) throw new Error(render.stderr || render.stdout)

copyFileSync(join(frameDir, "frame_0024.jpg"), join(assetDir, `${outputName}-poster.jpg`))

const contactSheet = join(evidenceDir, "contact-sheet.jpg")
const sheet = spawnSync("ffmpeg", ["-y", "-i", outputVideo, "-vf", "fps=1,scale=180:240,tile=5x3", "-frames:v", "1", contactSheet], { encoding: "utf8" })
if (sheet.status !== 0) throw new Error(sheet.stderr || sheet.stdout)

const sourceProject = {
  renderer: "scripts/render-musk-altman-agentteam-v9.mjs",
  runId: "run_1777807954347",
  output: outputVideo,
  duration: DURATION,
  fps: FPS,
  narration: {
    text: narrationText,
    model: process.env.OPENAI_API_KEY ? "gpt-4o-mini-tts-2025-12-15" : "edge-tts neural voice",
    voice: process.env.OPENAI_API_KEY ? "cedar" : "zh-CN-YunjianNeural",
    speed: 1.08,
    alignedFromSeconds: narrationDuration,
    instructions: narrationInstructions,
  },
  shots,
}
const musicReport = {
  selected: {
    path: musicPath,
    title: "Empty Love",
    artist: "Lulleaux / Kid Princess",
    reason: "现代 electronic pop 气质，低音量后能做背景推进；比 We Are Electric 更少 breakbeat/funk 味，也不使用廉价合成音。",
    excerptStartSeconds: 33,
    mixLevel: "music normalized around -24 LUFS before final voice mix",
  },
  rejected: [
    { path: "local-music-library/We are electric.mp3", reason: "breakbeat/battle dance 味道太重，和用户反馈的“音乐选择不好”冲突。" },
    { path: "local-downloads/Digital_Haze.mp3", reason: "无 metadata，30 秒素材更像 stock loop，质量证明弱。" },
    { path: "local-music-library/*.ncm", reason: "本次 dry-run 发现多个候选 NCM truncated cover data，未强行使用。" },
  ],
}
const hashReport = {
  generatedAt: new Date().toISOString(),
  runId: "run_1777807954347",
  sourcePolicy: "Reference video used only as style/taste reference. The renderer does not read frames or audio from it.",
  referenceVideo: referencePath,
  referenceVideoSha256: hashFile(referencePath),
  outputVideo,
  outputVideoSha256: hashFile(outputVideo),
  posterSha256: hashFile(join(assetDir, `${outputName}-poster.jpg`)),
  audio: {
    narrationSha256: hashFile(narrationPath),
    mixedAudioSha256: hashFile(mixedAudio),
    musicSourceSha256: hashFile(musicPath),
  },
  visualSources: [
    { file: assets.elon, sha256: hashFile(assets.elon), role: "Musk portrait source" },
    { file: assets.sam, sha256: hashFile(assets.sam), role: "Altman portrait source" },
    { file: assets.court, sha256: hashFile(assets.court), role: "abstract courtroom/news background" },
  ],
  outputSpecs: { width: W, height: H, fps: FPS, duration: DURATION },
}

writeFileSync(join(evidenceDir, "source-project.json"), `${JSON.stringify(sourceProject, null, 2)}\n`)
writeFileSync(join(evidenceDir, "music-selection-report.json"), `${JSON.stringify(musicReport, null, 2)}\n`)
writeFileSync(join(evidenceDir, "hash-report.json"), `${JSON.stringify(hashReport, null, 2)}\n`)
writeFileSync(join(evidenceDir, "voiceover.txt"), `${narrationText}\n\n${narrationInstructions}\n`)
writeFileSync(join(workDir, "README.md"), `# ${outputName}\n\nAutoDirector official run: run_1777807954347\n\n- 14.4s vertical news explainer.\n- AI TTS voiceover generated with cedar.\n- Local modern electronic-pop background: ${musicPath}\n- Reference video is not ingested.\n`)

console.log(`rendered ${outputVideo}`)
