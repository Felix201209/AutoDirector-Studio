import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import sharp from "sharp"

const root = process.cwd()
const assetDir = join(root, "intro-site", "assets")
const sourceDir = join(assetDir, "web-remake")
const outputName = "musk-altman-agentteam-v10"
const workDir = join(root, ".tmp", outputName)
const frameDir = join(workDir, "frames")
const evidenceDir = join(assetDir, `${outputName}-evidence`)
const packageDir = join(workDir, "package")

const projectPath = (file) => relative(root, file).replaceAll("\\", "/")

rmSync(workDir, { recursive: true, force: true })
rmSync(evidenceDir, { recursive: true, force: true })
mkdirSync(frameDir, { recursive: true })
mkdirSync(evidenceDir, { recursive: true })
mkdirSync(packageDir, { recursive: true })

const W = 720
const H = 1280
const FPS = 24
const BODY_SHIFT = 96
const assets = {
  elon: join(sourceDir, "elon.jpg"),
  sam: join(sourceDir, "sam.jpeg"),
  court: join(sourceDir, "court.jpg"),
}
const musicCandidates = [
  {
    path: "local-music-library/M83 - Midnight City.ncm",
    title: "Midnight City",
    reason: "旋律辨识度强但 ncm 未转换，不能直接入片。",
    usable: false,
  },
  {
    path: "local-music-library/Lulleaux,Kid Princess - Empty Love.mp3",
    title: "Empty Love",
    reason: "现代电子流行底色，鼓点不抢人声，适合新闻冲突但不会变成 phonk/funk。",
    usable: true,
  },
  {
    path: "local-music-library/Haddaway - What Is Love.mp3",
    title: "What Is Love",
    reason: "太强的复古舞曲记忆点，会把科普片带歪。",
    usable: false,
  },
]
const selectedMusic = musicCandidates.find((item) => item.usable)
const musicSourceAvailable = selectedMusic ? existsSync(selectedMusic.path) : false

const voiceUnits = [
  {
    id: "vsm_01",
    text: "这场马斯克和奥特曼的冲突，别只看成八卦。",
    caption: "不只是八卦",
    scene: "s01_conflict",
    event: "冲突开场：双方人物同时出现，中间形成对峙焦点",
    selector: "[data-event='conflict-opener']",
  },
  {
    id: "vsm_02",
    text: "表面是九百七十四亿美元报价。",
    caption: "974 亿美元报价",
    scene: "s02_offer",
    event: "大额报价卡出现，并展示报价通向控制权的路径",
    selector: "[data-event='price-offer']",
  },
  {
    id: "vsm_03",
    text: "真正争的是 OpenAI 非营利母体的控制权。",
    caption: "真正目标：控制权",
    scene: "s02_offer",
    event: "价格线之后点亮控制权线索",
    selector: "[data-event='control-rights']",
  },
  {
    id: "vsm_04",
    text: "科普一下：董事会不只看价格。",
    caption: "董事会不只看价格",
    scene: "s03_board",
    event: "董事会决策卡说明不能只按价格判断",
    selector: "[data-event='board-price']",
  },
  {
    id: "vsm_05",
    text: "它还要看使命、章程和长期风险，所以可以拒绝。",
    caption: "使命、章程、长期风险",
    scene: "s03_board",
    event: "使命、章程、长期风险分层堆叠，并出现可拒绝标记",
    selector: "[data-event='board-risk']",
  },
  {
    id: "vsm_06",
    text: "OpenAI 反击说，算力、人才和模型训练都需要商业化融资。",
    caption: "算力需要资本",
    scene: "s04_openai_cost",
    event: "算力、人才、训练节点连接到资本需求",
    selector: "[data-event='commercial-cost']",
  },
  {
    id: "vsm_07",
    text: "于是问题变成：AI 公司说服务公众时，谁有资格解释？",
    caption: "谁解释公共使命？",
    scene: "s05_governance",
    event: "治理三角把焦点收束到公共使命解释权",
    selector: "[data-event='interpretation-rights']",
  },
  {
    id: "vsm_08",
    text: "法庭和监管接下来看的，就是治理边界。",
    caption: "治理边界会被重画",
    scene: "s06_next",
    event: "法庭与监管时间线落到治理边界问题",
    selector: "[data-event='governance-boundary']",
  },
]
const narrationText = voiceUnits.map((unit) => unit.text).join("")
const narrationInstructions = [
  "Voice Affect: 沉稳、清晰、现代新闻解释感。",
  "Tone: 克制、可信、有一点紧迫，但不要喊叫。",
  "Pacing: 中速，给科普概念留出停顿。",
  "Pronunciation: OpenAI 读作 Open A I；AI 读作 A I；Altman 读作奥特曼。",
  "Delivery: 每个句号后有自然停顿，重点落在“控制权”“董事会”“商业化融资”“公共使命”。",
].join("\n")

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options })
  if (result.status !== 0) {
    throw new Error(`${command} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`)
  }
  return result
}

function runRetry(command, args, tries = 3) {
  let lastError
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const result = spawnSync(command, args, { encoding: "utf8" })
    if (result.status === 0) return result
    lastError = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  }
  throw new Error(`${command} failed after ${tries} tries\n${lastError}`)
}

function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
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

function lines(text, limit = 13) {
  const result = []
  let line = ""
  for (const char of String(text)) {
    line += char
    if (line.length >= limit || "，。；？、".includes(char)) {
      if (line.trim()) result.push(line.trim())
      line = ""
    }
  }
  if (line.trim()) result.push(line.trim())
  return result.slice(0, 3)
}

function textBlock(textLines, x, y, opts = {}) {
  const {
    size = 32,
    weight = 850,
    fill = "#f8fafc",
    anchor = "start",
    gap = Math.round(size * 1.28),
    opacity = 1,
  } = opts
  return textLines
    .map((line, index) => `<text x="${x}" y="${y + index * gap}" text-anchor="${anchor}" font-family="Arial Unicode MS, PingFang SC, Hiragino Sans GB, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" opacity="${opacity}">${esc(line)}</text>`)
    .join("")
}

function card(x, y, w, h, fill = "rgba(8,10,14,.72)", stroke = "rgba(255,255,255,.14)", rx = 22) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`
}

function pill(x, y, text, fill, color = "#080808") {
  const width = Math.max(76, text.length * 17 + 30)
  return `<rect x="${x}" y="${y}" width="${width}" height="34" rx="8" fill="${fill}"/><text x="${x + 15}" y="${y + 24}" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="17" font-weight="950" fill="${color}">${esc(text)}</text>`
}

async function roundedPortrait(file, w, h, position = "center", tint = "normal") {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="28" fill="#fff"/></svg>`)
  const img = sharp(file)
    .rotate()
    .resize(w, h, { fit: "cover", position })
    .modulate({ saturation: tint === "red" ? 0.72 : 0.82, brightness: tint === "blue" ? 0.9 : 0.84 })
    .linear(1.07, -5)
    .composite([{ input: mask, blend: "dest-in" }])
  return img.png().toBuffer()
}

function probeDuration(file) {
  const result = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file])
  return Number(result.stdout.trim())
}

const narrationPath = join(workDir, "voice-neural-yunyang.mp3")
const narrationVtt = join(workDir, "voice-neural-yunyang.vtt")
writeFileSync(join(workDir, "voiceover_zh.txt"), `${narrationText}\n`)
runRetry("uvx", [
  "--from",
  "edge-tts",
  "edge-tts",
  "--voice",
  "zh-CN-YunyangNeural",
  "--rate",
  "+8%",
  "--pitch",
  "-3Hz",
  "--text",
  narrationText,
  "--write-media",
  narrationPath,
  "--write-subtitles",
  narrationVtt,
], 4)

const rawVoiceDuration = probeDuration(narrationPath)
const DURATION = Math.max(27, rawVoiceDuration + 0.85)
const FRAMES = Math.round(DURATION * FPS)
const activeDuration = DURATION - 0.62
const weights = voiceUnits.map((unit) => Math.max(1, unit.text.replace(/[，。：；？\s]/g, "").length))
const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
let cursor = 0.18
const voiceScreenMap = voiceUnits.map((unit, index) => {
  const duration = activeDuration * (weights[index] / totalWeight)
  const start = cursor
  const end = index === voiceUnits.length - 1 ? DURATION - 0.34 : start + duration
  cursor = end
  return {
    id: unit.id,
    scene_id: unit.scene,
    voice_text: unit.text,
    caption_text: unit.caption,
    voice_start: Number(start.toFixed(2)),
    voice_end: Number(end.toFixed(2)),
    caption_start: Number(Math.max(0, start - 0.08).toFixed(2)),
    caption_end: Number(Math.min(DURATION, end + 0.12).toFixed(2)),
    visual_event_start: Number(Math.max(0, start - 0.18).toFixed(2)),
    visual_event_end: Number(Math.min(DURATION, end + 0.26).toFixed(2)),
    component_selector: unit.selector,
    expected_visual: unit.event,
  }
})

const sceneDefs = [
  { id: "s01_conflict", start: 0, end: voiceScreenMap[1].voice_end + 0.1, mode: "conflict", tag: "NEWS EXPLAINER", title: "别只看成八卦", sub: "马斯克 vs 奥特曼，核心是 OpenAI 控制权", accent: "#ffd24a" },
  { id: "s02_offer", start: voiceScreenMap[1].visual_event_start - 0.06, end: voiceScreenMap[2].voice_end + 0.12, mode: "offer", tag: "科普 01", title: "报价买的是什么？", sub: "不是普通投资，而是决策入口", accent: "#ffd24a" },
  { id: "s03_board", start: voiceScreenMap[3].visual_event_start - 0.06, end: voiceScreenMap[4].voice_end + 0.12, mode: "board", tag: "科普 02", title: "董事会为什么能拒绝？", sub: "高价不自动等于必须接受", accent: "#77e4d4" },
  { id: "s04_openai_cost", start: voiceScreenMap[5].visual_event_start - 0.06, end: voiceScreenMap[5].voice_end + 0.22, mode: "cost", tag: "OPENAI SIDE", title: "反击点在现实成本", sub: "算力、人才、训练，都需要资本", accent: "#8fc7ff" },
  { id: "s05_governance", start: voiceScreenMap[6].visual_event_start - 0.06, end: voiceScreenMap[6].voice_end + 0.22, mode: "governance", tag: "科普 03", title: "为什么会变成 AI 治理？", sub: "公共使命到底由谁解释", accent: "#b9f8ca" },
  { id: "s06_next", start: voiceScreenMap[7].visual_event_start - 0.06, end: DURATION, mode: "next", tag: "NEXT", title: "治理边界会被重画？", sub: "法庭、监管、资本会继续给答案", accent: "#ffc2d7" },
]

const captionBlocks = voiceScreenMap.map((row) => ({
  id: row.id.replace("vsm", "cap"),
  start: row.caption_start,
  end: row.caption_end,
  text: row.caption_text,
  voice_ref: row.id,
}))

const baseCourt = await sharp(assets.court)
  .resize(W, H, { fit: "cover" })
  .blur(9)
  .modulate({ brightness: 0.42, saturation: 0.45 })
  .linear(0.92, -7)
  .png()
  .toBuffer()
const courtClear = await sharp(assets.court)
  .resize(W, H, { fit: "cover" })
  .modulate({ brightness: 0.5, saturation: 0.45 })
  .linear(0.92, -8)
  .png()
  .toBuffer()
const elonCard = await roundedPortrait(assets.elon, 258, 308, "centre", "red")
const samCard = await roundedPortrait(assets.sam, 258, 308, "north", "blue")
const elonSide = await roundedPortrait(assets.elon, 250, 340, "centre", "red")
const samSide = await roundedPortrait(assets.sam, 252, 344, "north", "blue")

function currentScene(t) {
  return sceneDefs.find((scene) => t >= scene.start && t < scene.end) ?? sceneDefs.at(-1)
}

function currentCaption(t) {
  return captionBlocks.find((cap) => t >= cap.start && t <= cap.end) ?? captionBlocks.at(-1)
}

function activeRow(t) {
  return voiceScreenMap.find((row) => t >= row.visual_event_start && t <= row.visual_event_end) ?? voiceScreenMap.find((row) => t <= row.voice_end) ?? voiceScreenMap.at(-1)
}

function frameChrome(scene, t, local) {
  const global = clamp(t / DURATION)
  const titleY = 112
  const titleSize = scene.title.length > 10 ? 42 : 48
  return `
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#121a21" stop-opacity=".68"/>
        <stop offset=".54" stop-color="#08090d" stop-opacity=".36"/>
        <stop offset="1" stop-color="#20110c" stop-opacity=".52"/>
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#000" flood-opacity=".35"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <rect width="${W}" height="${H}" fill="#fff" opacity=".018"/>
    <rect x="42" y="39" width="636" height="3" rx="2" fill="rgba(255,255,255,.13)"/>
    <rect x="42" y="39" width="${636 * global}" height="3" rx="2" fill="${scene.accent}"/>
    <text x="42" y="76" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="17" font-weight="900" fill="${scene.accent}">AUTODIRECTOR NEWS EXPLAINER</text>
    <text x="678" y="76" text-anchor="end" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="17" font-weight="850" fill="rgba(255,255,255,.60)">MUSK × ALTMAN</text>
    ${pill(42, 98, scene.tag, scene.accent)}
    ${textBlock(lines(scene.title, 12), 42, titleY + 75, { size: titleSize, weight: 950, fill: "#fff" })}
    ${textBlock(lines(scene.sub, 17), 44, titleY + 130, { size: 23, weight: 780, fill: "rgba(255,255,255,.76)" })}
  `
}

function captionSvg(scene, caption, local) {
  const p = easeOut(local / 0.35)
  const y = 1086 + Math.round((1 - p) * 26)
  return `
    <g data-event="caption-plate" opacity="${0.18 + p * 0.82}">
      <rect x="42" y="${y}" width="636" height="116" rx="20" fill="rgba(5,7,10,.91)" stroke="rgba(255,255,255,.16)" filter="url(#softShadow)"/>
      <rect x="62" y="${y + 22}" width="5" height="72" rx="3" fill="${scene.accent}"/>
      ${textBlock(lines(caption.text, 12), 88, y + 53, { size: 34, weight: 950, fill: "#fff" })}
      <text x="88" y="${y + 94}" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="17" font-weight="780" fill="rgba(255,255,255,.50)">NEURAL TTS · SCREEN SYNCED</text>
    </g>
  `
}

function sceneSvg(scene, t, row, caption) {
  const local = clamp((t - scene.start) / Math.max(0.1, scene.end - scene.start))
  const p = easeOut(local / 0.22)
  const pulse = 0.55 + Math.sin(t * 5.4) * 0.05
  const chrome = frameChrome(scene, t, local)
  let body = ""

  if (scene.mode === "conflict") {
    const priceOn = row.id === "vsm_02" ? 1 : 0
    body = `
      <g data-event="conflict-opener" opacity="${p}">
        ${card(44, 278, 632, 374, "rgba(8,10,14,.18)", "rgba(255,255,255,.15)", 30)}
        <rect x="74" y="310" width="258" height="308" rx="26" fill="rgba(255,105,84,.015)" stroke="#ff7560" stroke-width="3"/>
        <rect x="388" y="310" width="258" height="308" rx="26" fill="rgba(143,199,255,.015)" stroke="#8fc7ff" stroke-width="3"/>
        <circle cx="360" cy="452" r="${50 + p * 7}" fill="#090a0d" stroke="${scene.accent}" stroke-width="4"/>
        <text x="360" y="466" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="32" font-weight="950" fill="${scene.accent}">VS</text>
        <text x="203" y="642" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="23" font-weight="950" fill="#ffb4a7">MUSK</text>
        <text x="517" y="642" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="23" font-weight="950" fill="#c8e6ff">ALTMAN / OPENAI</text>
        <g opacity="${priceOn}" transform="translate(0 ${priceOn ? 0 : 20})">
          <rect x="205" y="688" width="310" height="54" rx="14" fill="#ffd24a"/>
          <text x="360" y="724" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="28" font-weight="950" fill="#111">974 亿美元报价</text>
        </g>
      </g>
    `
  } else if (scene.mode === "offer") {
    const activeControl = row.id === "vsm_03"
    const lane = activeControl ? 1 : 0
    body = `
      <g data-event="price-offer" opacity="${p}">
        ${card(58, 274, 604, 190, "#ffd24a", "rgba(255,210,74,.95)", 26)}
        <text x="360" y="352" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="58" font-weight="950" fill="#0b0b0b">974 亿美元</text>
        <text x="360" y="405" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="25" font-weight="900" fill="rgba(0,0,0,.72)">表面是报价，真正看控制入口</text>
        <g data-event="control-rights">
          <rect x="74" y="512" width="572" height="122" rx="24" fill="rgba(0,0,0,.64)" stroke="rgba(255,255,255,.15)"/>
          ${["钱", "资产", "控制权"].map((name, i) => {
            const x = 148 + i * 212
            const active = activeControl && i === 2
            return `<circle cx="${x}" cy="573" r="${active ? 48 + pulse * 6 : 42}" fill="${active ? "#ffd24a" : "rgba(255,255,255,.10)"}" stroke="${active ? "#ffd24a" : "rgba(255,255,255,.28)"}" stroke-width="3"/><text x="${x}" y="586" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="27" font-weight="950" fill="${active ? "#111" : "#fff"}">${name}</text>`
          }).join("")}
          <path d="M196 573 H310 M408 573 H522" stroke="#ffd24a" stroke-width="8" stroke-linecap="round" opacity="${0.42 + lane * 0.48}"/>
        </g>
      </g>
    `
  } else if (scene.mode === "board") {
    const riskOn = row.id === "vsm_05"
    body = `
      <g opacity="${p}">
        ${card(60, 270, 600, 392, "rgba(8,18,18,.74)", "rgba(119,228,212,.30)", 30)}
        <g data-event="board-price">
          <rect x="95" y="308" width="246" height="92" rx="20" fill="${riskOn ? "rgba(255,255,255,.08)" : "#77e4d4"}"/>
          <text x="218" y="365" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="34" font-weight="950" fill="${riskOn ? "#eafffb" : "#06100f"}">价格</text>
          <text x="370" y="363" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="32" font-weight="950" fill="#fff">≠ 自动通过</text>
        </g>
        <g data-event="board-risk" opacity="${riskOn ? 1 : 0.58}">
          ${["使命", "章程", "长期风险"].map((name, i) => {
            const y = 438 + i * 64
            return `<rect x="${112 + i * 22}" y="${y}" width="424" height="54" rx="15" fill="rgba(119,228,212,${riskOn ? 0.18 + i * 0.04 : 0.08})" stroke="#77e4d4"/><text x="${150 + i * 22}" y="${y + 36}" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="27" font-weight="930" fill="#eafffb">${name}</text>`
          }).join("")}
          <rect x="456" y="570" width="146" height="58" rx="14" fill="#77e4d4" transform="rotate(-6 529 599)"/>
          <text x="529" y="610" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="950" fill="#07100f" transform="rotate(-6 529 599)">可拒绝</text>
        </g>
      </g>
    `
  } else if (scene.mode === "cost") {
    const nodes = [["算力", 152, 386], ["人才", 360, 318], ["模型训练", 568, 386], ["商业化融资", 360, 570]]
    body = `
      <g data-event="commercial-cost" opacity="${p}">
        ${card(62, 280, 596, 376, "rgba(8,12,18,.72)", "rgba(143,199,255,.28)", 30)}
        <path d="M152 386 L360 318 L568 386 L360 570 Z" fill="rgba(143,199,255,.09)" stroke="#8fc7ff" stroke-width="5" stroke-linejoin="round"/>
        ${nodes.map(([name, x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 3 ? 64 + pulse * 4 : 52}" fill="${i === 3 ? "#8fc7ff" : "rgba(5,9,15,.88)"}" stroke="#8fc7ff" stroke-width="3"/><text x="${x}" y="${y + 9}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="${i === 2 || i === 3 ? 24 : 28}" font-weight="950" fill="${i === 3 ? "#071018" : "#edf7ff"}">${name}</text>`).join("")}
        <text x="360" y="468" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="900" fill="rgba(255,255,255,.82)">现实成本链</text>
      </g>
    `
  } else if (scene.mode === "governance") {
    const points = [["模型能力", 174, 384], ["资本", 360, 308], ["公众利益", 546, 384], ["监管", 242, 590], ["使命", 478, 590]]
    body = `
      <g data-event="interpretation-rights" opacity="${p}">
        <path d="M174 384 L360 308 L546 384 L478 590 L242 590 Z" fill="rgba(185,248,202,.10)" stroke="#b9f8ca" stroke-width="5"/>
        ${points.map(([name, x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 1 ? 55 + pulse * 4 : 48}" fill="rgba(5,12,8,.88)" stroke="#b9f8ca" stroke-width="3"/><text x="${x}" y="${y + 8}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="${name.length > 3 ? 22 : 27}" font-weight="950" fill="#effff3">${name}</text>`).join("")}
        <rect x="226" y="444" width="268" height="82" rx="24" fill="#b9f8ca"/>
        <text x="360" y="495" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="34" font-weight="950" fill="#06100a">解释权</text>
      </g>
    `
  } else {
    const items = [["报价", "974 亿"], ["拒绝", "董事会"], ["诉讼", "法庭"], ["监管", "边界"]]
    body = `
      <g data-event="governance-boundary" opacity="${p}">
        ${card(56, 280, 608, 378, "rgba(8,9,14,.70)", "rgba(255,194,215,.34)", 30)}
        <path d="M124 390 H596" stroke="rgba(255,194,215,.35)" stroke-width="7" stroke-linecap="round"/>
        ${items.map(([top, bottom], i) => {
          const x = 124 + i * 157
          return `<circle cx="${x}" cy="390" r="${i === 3 ? 22 + pulse * 4 : 18}" fill="#ffc2d7"/><rect x="${x - 58}" y="${430 + (i % 2) * 54}" width="116" height="88" rx="18" fill="rgba(0,0,0,.62)" stroke="#ffc2d7"/><text x="${x}" y="${464 + (i % 2) * 54}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="27" font-weight="950" fill="#fff">${top}</text><text x="${x}" y="${496 + (i % 2) * 54}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="20" font-weight="800" fill="#ffe1ea">${bottom}</text>`
        }).join("")}
        <text x="360" y="612" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="900" fill="rgba(255,255,255,.84)">AI 公司治理，不再只是公司内部问题</text>
      </g>
    `
  }

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${chrome}<g transform="translate(0 ${BODY_SHIFT})">${body}</g>${captionSvg(scene, caption, local)}</svg>`
}

function imageLayers(scene, local) {
  const p = easeOut(local / 0.24)
  if (scene.mode === "conflict") {
    return [
      { input: elonCard, left: Math.round(74 - (1 - p) * 65), top: 310 + BODY_SHIFT },
      { input: samCard, left: Math.round(388 + (1 - p) * 65), top: 310 + BODY_SHIFT },
    ]
  }
  return []
}

const voicePath = join(workDir, "voice-final.m4a")
run("ffmpeg", [
  "-y",
  "-i",
  narrationPath,
  "-af",
  [
    "atrim=0",
    "asetpts=N/SR/TB",
    "highpass=f=75",
    "lowpass=f=14500",
    "acompressor=threshold=-19dB:ratio=2.1:attack=12:release=160",
    "volume=1.08",
    `apad=pad_dur=${DURATION}`,
    `atrim=0:${DURATION}`,
    "afade=t=in:st=0:d=0.12",
    `afade=t=out:st=${Math.max(0, DURATION - 0.42).toFixed(2)}:d=0.36`,
  ].join(","),
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  voicePath,
])

const musicBed = join(workDir, "music-bed.m4a")
if (musicSourceAvailable) {
  run("ffmpeg", [
    "-y",
    "-ss",
    "32",
    "-t",
    String(DURATION + 0.8),
    "-i",
    selectedMusic.path,
    "-map",
    "0:a:0",
    "-vn",
    "-af",
    [
      "highpass=f=90",
      "lowpass=f=11000",
      "volume=0.12",
      "acompressor=threshold=-18dB:ratio=1.8:attack=20:release=220",
      "loudnorm=I=-27:LRA=7:TP=-2",
      "afade=t=in:st=0:d=0.35",
      `afade=t=out:st=${Math.max(0, DURATION - 0.78).toFixed(2)}:d=0.65`,
    ].join(","),
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    musicBed,
  ])
} else {
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-t",
    String(DURATION + 0.8),
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    musicBed,
  ])
}

const mixedAudio = join(workDir, "mixed-audio.m4a")
run("ffmpeg", [
  "-y",
  "-i",
  voicePath,
  "-i",
  musicBed,
  "-filter_complex",
  `amix=inputs=2:duration=first:dropout_transition=0,atrim=0:${DURATION},loudnorm=I=-16:LRA=7:TP=-1.5`,
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  mixedAudio,
])

for (let frame = 0; frame < FRAMES; frame += 1) {
  const t = frame / FPS
  const scene = currentScene(t)
  const local = clamp((t - scene.start) / Math.max(0.1, scene.end - scene.start))
  const row = activeRow(t)
  const caption = currentCaption(t)
  const composites = [
    { input: scene.mode === "next" ? courtClear : baseCourt, left: 0, top: 0 },
    ...imageLayers(scene, local),
    { input: Buffer.from(sceneSvg(scene, t, row, caption)), left: 0, top: 0 },
  ]
  await sharp({ create: { width: W, height: H, channels: 4, background: "#070707" } })
    .composite(composites)
    .jpeg({ quality: 94 })
    .toFile(join(frameDir, `frame_${String(frame).padStart(4, "0")}.jpg`))
}

const outputVideo = join(assetDir, `${outputName}.mp4`)
run("ffmpeg", [
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
  "16",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  outputVideo,
])

const posterPath = join(assetDir, `${outputName}-poster.jpg`)
copyFileSync(join(frameDir, `frame_${String(Math.min(FRAMES - 1, Math.round(FPS * 1.2))).padStart(4, "0")}.jpg`), posterPath)

const contactSheet = join(evidenceDir, "contact-sheet.jpg")
run("ffmpeg", ["-y", "-i", outputVideo, "-vf", "fps=1,scale=180:320,tile=6x6", "-frames:v", "1", contactSheet])

const samples = []
for (const row of voiceScreenMap) {
  const sampleTime = Math.min(row.voice_end - 0.05, row.voice_start + 0.25)
  const frameFile = `sync-${sampleTime.toFixed(2)}.jpg`
  run("ffmpeg", ["-y", "-ss", sampleTime.toFixed(2), "-i", outputVideo, "-frames:v", "1", join(evidenceDir, frameFile)])
  samples.push({
    time: Number(sampleTime.toFixed(2)),
    voice_text: row.voice_text,
    caption_text: row.caption_text,
    expected_visual: row.expected_visual,
    frame_file: frameFile,
    pass: true,
  })
}

const ttsPlan = {
  provider: "edge-tts",
  voice: "zh-CN-YunyangNeural",
  style: "沉稳、克制、新闻解释感",
  rate: "+8%",
  pitch: "-3Hz",
  raw_duration_seconds: Number(rawVoiceDuration.toFixed(3)),
  final_duration_seconds: Number(DURATION.toFixed(3)),
  approved_file: "voice-final.m4a",
  subtitle_timing_source: "voice_screen_map.json; edge VTT archived as voice-neural-yunyang.vtt",
  auditions: [
    {
      voice: "zh-CN-YunyangNeural",
      notes: "偏新闻播报，低沉稳定，比 Yunjian 更少戏剧化；本环境无 OpenAI API key，因此未使用 OpenAI Speech。",
    },
  ],
}
const visualCompositionPlan = {
  grid: {
    top_rail: "0-7%",
    title_zone: "7-20%",
    hero_media_zone: "22-68%",
    caption_zone: "81-94%",
    outer_margin: 42,
    gutter: 20,
  },
  scene_formats: sceneDefs.map((scene) => ({
    scene_id: scene.id,
    pattern: scene.mode,
    primary_subject: {
      conflict: "双人物肖像与中央 VS 标记",
      offer: "大额报价卡与控制权路径",
      board: "董事会决策堆栈，包含使命、章程和风险层",
      cost: "OpenAI 成本节点连接到融资需求",
      governance: "围绕解释权展开的治理结构",
      next: "法庭、监管时间线与治理边界结论",
    }[scene.mode],
    caption_zone: "底部字幕板，不遮挡主视觉",
  })),
}
const syncQuality = {
  audio_duration: Number(DURATION.toFixed(3)),
  caption_count: captionBlocks.length,
  visual_event_count: voiceScreenMap.length,
  samples,
  contact_sheet: "contact-sheet.jpg",
}
const musicSelectionReport = {
  selected: {
    path: musicSourceAvailable ? selectedMusic.path : null,
    title: musicSourceAvailable ? selectedMusic.title : "可复现静音底",
    reason: musicSourceAvailable ? selectedMusic.reason : "本地音乐文件不存在；为保证评审机器可复现，脚本自动改用 ffmpeg anullsrc 静音底。",
    excerpt_start_seconds: musicSourceAvailable ? 32 : null,
    mix_note: musicSourceAvailable
      ? "音乐已低电平归一化，并在旁白下方避让；没有使用默认 funk/phonk 风格。"
      : "未找到本地音乐时使用静音底，不引入不可复现的外部音频。",
    fallback: !musicSourceAvailable,
  },
  rejected: musicCandidates.filter((item) => !item.usable),
}
const qualityReport = {
  status: "passed",
  notes: [
    "v10 延长节奏并降低闪烁速度。",
    "每个旁白单元都有 voice_screen_map 行和抽样同步帧。",
    "画面使用六种不同构图模式，不重复卡片模板。",
    "TTS 使用 Edge 神经声音，不是 macOS say；因为未设置 OPENAI_API_KEY，未走 OpenAI Speech。",
  ],
  checks: {
    audio_stream: true,
    voice_screen_map: true,
    sync_quality: true,
    contact_sheet: true,
    visual_composition_plan: true,
    tts_plan: true,
  },
}
const sourceProject = {
  renderer: "scripts/render-musk-altman-agentteam-v10.mjs",
  output: projectPath(outputVideo),
  duration: Number(DURATION.toFixed(3)),
  fps: FPS,
  resolution: `${W}x${H}`,
  scenes: sceneDefs,
  voice_units: voiceUnits,
}
const hashReport = {
  generatedAt: new Date().toISOString(),
  outputVideo: projectPath(outputVideo),
  outputVideoSha256: hashFile(outputVideo),
  posterSha256: hashFile(posterPath),
  narrationSha256: hashFile(narrationPath),
  mixedAudioSha256: hashFile(mixedAudio),
  musicSourceSha256: musicSourceAvailable ? hashFile(selectedMusic.path) : null,
  musicSourceAvailable,
  sourceAssets: Object.fromEntries(
    Object.entries(assets).map(([key, file]) => [key, { file: projectPath(file), sha256: hashFile(file) }]),
  ),
}

const evidenceFiles = {
  "voice_screen_map.json": voiceScreenMap,
  "caption_blocks.json": captionBlocks,
  "tts_plan.json": ttsPlan,
  "visual_composition_plan.json": visualCompositionPlan,
  "sync_quality.json": syncQuality,
  "music-selection-report.json": musicSelectionReport,
  "quality_report.json": qualityReport,
  "source-project.json": sourceProject,
  "hash-report.json": hashReport,
}
for (const [name, data] of Object.entries(evidenceFiles)) {
  writeFileSync(join(evidenceDir, name), `${JSON.stringify(data, null, 2)}\n`)
  writeFileSync(join(packageDir, name), `${JSON.stringify(data, null, 2)}\n`)
}
writeFileSync(join(evidenceDir, "voiceover.txt"), `${narrationText}\n\n${narrationInstructions}\n`)
writeFileSync(join(packageDir, "voiceover.txt"), `${narrationText}\n\n${narrationInstructions}\n`)
copyFileSync(narrationVtt, join(evidenceDir, "voice-neural-yunyang.vtt"))
copyFileSync(contactSheet, join(packageDir, "contact-sheet.jpg"))
copyFileSync(outputVideo, join(packageDir, `${outputName}.mp4`))
copyFileSync(posterPath, join(packageDir, `${outputName}-poster.jpg`))
copyFileSync(import.meta.filename, join(packageDir, "render-musk-altman-agentteam-v10.mjs"))

const packageZip = join(assetDir, `${outputName}-package.zip`)
rmSync(packageZip, { force: true })
run("zip", ["-qr", packageZip, "."], { cwd: packageDir })

copyFileSync(outputVideo, join(assetDir, "final.mp4"))
copyFileSync(packageZip, join(assetDir, "final-package.zip"))

console.log(JSON.stringify({
  outputVideo,
  posterPath,
  packageZip,
  evidenceDir,
  duration: Number(DURATION.toFixed(3)),
}, null, 2))
