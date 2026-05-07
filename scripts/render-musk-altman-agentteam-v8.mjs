import { mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import sharp from "sharp"

const root = process.cwd()
const assetDir = join(root, "intro-site", "assets")
const sourceDir = join(assetDir, "web-remake")
const workDir = join(root, ".tmp", "musk-altman-agentteam-v8")
const frameDir = join(workDir, "frames")
const evidenceDir = join(assetDir, "musk-altman-agentteam-v8-evidence")
const outputName = "musk-altman-agentteam-v8"

rmSync(workDir, { recursive: true, force: true })
mkdirSync(frameDir, { recursive: true })
mkdirSync(evidenceDir, { recursive: true })

const W = 720
const H = 960
const FPS = 24
const DURATION = 12.0
const FRAMES = Math.round(DURATION * FPS)
const musicPath = "local-music-library/We are electric.mp3"
const referencePath = "local-reference/reference-video.mp4"

const assets = {
  elon: join(sourceDir, "elon.jpg"),
  sam: join(sourceDir, "sam.jpeg"),
  court: join(sourceDir, "court.jpg"),
}

const shots = [
  { start: 0.00, end: 1.05, type: "money", kicker: "BREAKING", title: "974 亿美元", sub: "公开报道中的收购报价，被 OpenAI 拒绝", note: "先看事件：这不是普通投资，而是想改变公司方向。", accent: "#ffe15a" },
  { start: 1.05, end: 2.20, type: "musk", kicker: "MUSK", title: "出价不是终点", sub: "马斯克一方强调早期公益使命", note: "他争的不是一张股票票据，而是谁能定义 OpenAI。", accent: "#ff684d" },
  { start: 2.20, end: 3.35, type: "altman", kicker: "OPENAI", title: "董事会拒绝", sub: "OpenAI 一方拒绝出售控制权", note: "董事会不是只看价格，也要判断使命和结构风险。", accent: "#67e8f9" },
  { start: 3.35, end: 4.55, type: "explain", kicker: "科普 01", title: "报价是什么？", sub: "收购报价 = 用价格换控制权或重组谈判筹码", note: "金额很大，但核心问题是：谁能拿到方向盘。", accent: "#facc15" },
  { start: 4.55, end: 5.75, type: "split", kicker: "VS", title: "报价变战争", sub: "估值谈判升级为治理冲突", note: "双方争的是 OpenAI 是否背离最初承诺。", accent: "#ffe15a" },
  { start: 5.75, end: 7.00, type: "document", kicker: "MISSION", title: "公益使命", sub: "谁能定义 OpenAI 的最初承诺？", note: "非营利叙事、商业化现实和公众利益在这里撞上。", accent: "#f9fafb" },
  { start: 7.00, end: 8.25, type: "structure", kicker: "科普 02", title: "董事会为什么关键？", sub: "董事会控制章程、交易、治理和长期方向", note: "所以这不是单纯买卖，而是治理权的争夺。", accent: "#a7f3d0" },
  { start: 8.25, end: 9.35, type: "counter", kicker: "COUNTER", title: "OpenAI 反击", sub: "商业结构被解释为继续研发的现实条件", note: "算力、人才和模型训练，都需要巨额资本支撑。", accent: "#67e8f9" },
  { start: 9.35, end: 10.55, type: "governance", kicker: "科普 03", title: "为什么影响 AI 行业？", sub: "当模型、资本和公益使命绑在一起，监管会更难", note: "这场冲突会变成 AI 公司治理的样本。", accent: "#fb7185" },
  { start: 10.55, end: 12.00, type: "final", kicker: "FINAL QUESTION", title: "谁说了算？", sub: "这不是口水仗，是 AI 治理样本", note: "钱、技术、使命，最后都落到控制权。", accent: "#ffe15a" },
]

function clamp(v, min = 0, max = 1) { return Math.max(min, Math.min(max, v)) }
function ease(t) { return 1 - Math.pow(1 - clamp(t), 3) }
function esc(s) { return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") }
function hashFile(file) { return createHash("sha256").update(readFileSync(file)).digest("hex") }
function currentShot(t) { return shots.find((s) => t >= s.start && t < s.end) ?? shots.at(-1) }

async function portrait(file, w, h, pos = "center") {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="26" fill="#fff"/></svg>`)
  return sharp(file).rotate().resize(w, h, { fit: "cover", position: pos }).modulate({ saturation: 0.9, brightness: 0.86 }).linear(1.08, -4).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer()
}

const court = await sharp(assets.court).resize(W, H, { fit: "cover" }).blur(7).modulate({ brightness: 0.42, saturation: 0.5 }).png().toBuffer()
const elonClose = await portrait(assets.elon, 420, 560, "centre")
const samClose = await portrait(assets.sam, 420, 560, "north")
const elonSmall = await portrait(assets.elon, 280, 360, "centre")
const samSmall = await portrait(assets.sam, 280, 360, "north")

function baseOverlay(t, shot, local) {
  const flash = local < 0.045 ? (1 - local / 0.045) : 0
  const scanY = (t * 430) % H
  return `
    <rect width="${W}" height="${H}" fill="rgba(0,0,0,.34)"/>
    <rect x="26" y="24" width="668" height="912" fill="none" stroke="${shot.accent}" stroke-width="3" opacity=".48"/>
    <rect x="0" y="${scanY}" width="${W}" height="2" fill="#fff" opacity=".055"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fff" opacity="${flash * 0.09}"/>
  `
}

function lower(shot) {
  return `
    <rect x="42" y="716" width="636" height="160" rx="18" fill="rgba(4,5,8,.88)" stroke="rgba(255,255,255,.2)"/>
    <text x="70" y="764" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="27" font-weight="900" fill="#fff">${esc(shot.sub)}</text>
    <text x="70" y="810" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="23" font-weight="760" fill="#d9e3df">${esc(shot.note ?? "")}</text>
    <text x="70" y="848" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="20" font-weight="800" fill="${shot.accent}">MUSK × ALTMAN · OPENAI CONTROL FIGHT</text>
  `
}

function headline(shot, local, size = 66) {
  const y = 138 + (1 - ease(local / 0.22)) * 42
  return `
    <rect x="42" y="46" width="210" height="48" rx="8" fill="${shot.accent}"/>
    <text x="58" y="79" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="22" font-weight="950" fill="#050505">${esc(shot.kicker)}</text>
    <text x="360" y="${y}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="${size}" font-weight="950" fill="${shot.accent}" stroke="#050505" stroke-width="6" paint-order="stroke">${esc(shot.title)}</text>
  `
}

function svgFor(shot, t, local) {
  const p = ease(local / 0.3)
  const common = baseOverlay(t, shot, local)
  const h = headline(shot, local, shot.title.length > 6 ? 54 : 70)
  if (shot.type === "money") {
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      <rect x="58" y="250" width="604" height="260" rx="26" fill="rgba(255,225,90,.95)"/>
      <text x="360" y="352" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="82" font-weight="950" fill="#060606">1870 亿</text>
      <text x="360" y="432" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="46" font-weight="950" fill="#060606">美元报价被拒</text>
      ${h}${lower(shot)}</svg>`
  }
  if (shot.type === "musk" || shot.type === "altman") {
    const right = shot.type === "altman"
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      <rect x="${right ? 42 : 370}" y="260" width="300" height="390" rx="24" fill="rgba(0,0,0,.74)" stroke="${shot.accent}" stroke-width="4"/>
      <text x="${right ? 192 : 520}" y="365" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="44" font-weight="950" fill="${shot.accent}">${right ? "拒绝" : "出价"}</text>
      <text x="${right ? 192 : 520}" y="426" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="900" fill="#fff">${right ? "董事会" : "控制权"}</text>
      <text x="${right ? 192 : 520}" y="480" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="900" fill="#fff">${right ? "不出售" : "公益使命"}</text>
      ${h}${lower(shot)}</svg>`
  }
  if (shot.type === "split") {
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      <path d="M360 230 L360 704" stroke="${shot.accent}" stroke-width="8" stroke-dasharray="18 14"/>
      <circle cx="360" cy="468" r="76" fill="#050505" stroke="${shot.accent}" stroke-width="6"/>
      <text x="360" y="492" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="58" font-weight="950" fill="${shot.accent}">VS</text>
      ${h}${lower(shot)}</svg>`
  }
  if (shot.type === "document") {
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      <g transform="translate(${70 + p * 14},240) rotate(${-5 + p * 4})">
        <rect width="560" height="430" rx="22" fill="#f8fafc"/>
        <rect x="38" y="48" width="210" height="24" fill="#111827"/>
        <rect x="38" y="104" width="470" height="16" fill="#cbd5e1"/>
        <rect x="38" y="145" width="420" height="16" fill="#cbd5e1"/>
        <rect x="38" y="186" width="470" height="16" fill="#cbd5e1"/>
        <ellipse cx="336" cy="250" rx="160" ry="48" fill="none" stroke="#ef4444" stroke-width="12"/>
        <text x="280" y="340" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="52" font-weight="950" fill="#ef4444" text-anchor="middle">MISSION</text>
      </g>${h}${lower(shot)}</svg>`
  }
  if (shot.type === "explain") {
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      <rect x="66" y="248" width="588" height="372" rx="28" fill="rgba(250,204,21,.94)"/>
      <text x="360" y="326" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="48" font-weight="950" fill="#050505">收购报价</text>
      <path d="M150 410 H570" stroke="#050505" stroke-width="10" stroke-linecap="round"/>
      <circle cx="190" cy="410" r="42" fill="#050505"/><text x="190" y="422" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="950" fill="#fff">钱</text>
      <circle cx="360" cy="410" r="42" fill="#050505"/><text x="360" y="422" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="950" fill="#fff">股</text>
      <circle cx="530" cy="410" r="42" fill="#050505"/><text x="530" y="422" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="950" fill="#fff">权</text>
      <text x="360" y="515" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="34" font-weight="900" fill="#050505">价格只是表面</text>
      <text x="360" y="562" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="31" font-weight="900" fill="#050505">真正换的是控制权</text>
      ${h}${lower(shot)}</svg>`
  }
  if (shot.type === "structure" || shot.type === "counter") {
    const nodes = [["资本",120,330],["算力",360,272],["董事会",590,330],["公益使命",360,540]]
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      <path d="M120 330 L360 272 L590 330 L360 540 Z" fill="none" stroke="${shot.accent}" stroke-width="8" opacity=".76"/>
      ${nodes.map(([n,x,y])=>`<circle cx="${x}" cy="${y}" r="74" fill="rgba(0,0,0,.78)" stroke="${shot.accent}" stroke-width="4"/><text x="${x}" y="${y+10}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="32" font-weight="950" fill="#fff">${n}</text>`).join("")}
      ${h}${lower(shot)}</svg>`
  }
  if (shot.type === "governance") {
    const nodes = [["模型",135,330],["资本",360,282],["公众",585,330],["监管",235,560],["使命",485,560]]
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      <path d="M135 330 L360 282 L585 330 L485 560 L235 560 Z" fill="rgba(251,113,133,.10)" stroke="${shot.accent}" stroke-width="6" opacity=".82"/>
      ${nodes.map(([n,x,y])=>`<circle cx="${x}" cy="${y}" r="66" fill="rgba(0,0,0,.82)" stroke="${shot.accent}" stroke-width="4"/><text x="${x}" y="${y+10}" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="30" font-weight="950" fill="#fff">${n}</text>`).join("")}
      <text x="360" y="462" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="38" font-weight="950" fill="${shot.accent}">AI 治理</text>
      ${h}${lower(shot)}</svg>`
  }
  if (shot.type === "triptych") {
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      ${["钱","权","使命"].map((n,i)=>`<rect x="${70+i*200}" y="300" width="170" height="300" rx="22" fill="rgba(0,0,0,.8)" stroke="${shot.accent}" stroke-width="4"/><text x="${155+i*200}" y="470" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="76" font-weight="950" fill="${shot.accent}">${n}</text>`).join("")}
      ${h}${lower(shot)}</svg>`
  }
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${common}
      <rect x="40" y="260" width="640" height="356" rx="32" fill="rgba(0,0,0,.82)" stroke="${shot.accent}" stroke-width="5"/>
      <text x="360" y="410" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="84" font-weight="950" fill="${shot.accent}">${esc(shot.title)}</text>
      <text x="360" y="490" text-anchor="middle" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="38" font-weight="900" fill="#fff">${esc(shot.sub)}</text>
      ${h}</svg>`
}

function placements(shot, local) {
  const p = ease(local / 0.25)
  if (shot.type === "musk") return [{ img: elonClose, x: 42 - (1 - p) * 90, y: 210 }]
  if (shot.type === "altman") return [{ img: samClose, x: 258 + (1 - p) * 90, y: 210 }]
  if (shot.type === "split" || shot.type === "final") return [{ img: elonSmall, x: 58 - (1-p)*70, y: 286 }, { img: samSmall, x: 382 + (1-p)*70, y: 286 }]
  if (shot.type === "counter") return [{ img: samSmall, x: 420, y: 250 }]
  return []
}

for (let frame = 0; frame < FRAMES; frame += 1) {
  const t = frame / FPS
  const shot = currentShot(t)
  const local = (t - shot.start) / (shot.end - shot.start)
  const comps = [{ input: court, left: 0, top: 0 }, ...placements(shot, local).map((p) => ({ input: p.img, left: Math.round(p.x), top: Math.round(p.y) })), { input: Buffer.from(svgFor(shot, t, local)), left: 0, top: 0 }]
  await sharp({ create: { width: W, height: H, channels: 4, background: "#050505" } }).composite(comps).jpeg({ quality: 92 }).toFile(join(frameDir, `frame_${String(frame).padStart(4, "0")}.jpg`))
}

const selectedMusic = join(workDir, "music-bed.m4a")
const music = spawnSync("ffmpeg", [
  "-y", "-ss", "38", "-t", String(DURATION + 0.2), "-i", musicPath,
  "-map", "0:a:0", "-vn",
  "-af", "highpass=f=55,lowpass=f=15500,volume=0.70,afade=t=in:st=0:d=0.12,afade=t=out:st=11.35:d=0.55,loudnorm=I=-14:LRA=6:TP=-1.2",
  "-c:a", "aac", "-b:a", "192k", selectedMusic,
], { encoding: "utf8" })
if (music.status !== 0) throw new Error(music.stderr || music.stdout)

const outputVideo = join(assetDir, `${outputName}.mp4`)
const render = spawnSync("ffmpeg", [
  "-y", "-framerate", String(FPS), "-i", join(frameDir, "frame_%04d.jpg"), "-i", selectedMusic,
  "-shortest", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", outputVideo,
], { encoding: "utf8" })
if (render.status !== 0) throw new Error(render.stderr || render.stdout)

copyFileSync(join(frameDir, "frame_0030.jpg"), join(assetDir, `${outputName}-poster.jpg`))

const contactSheet = join(evidenceDir, "contact-sheet.jpg")
spawnSync("ffmpeg", ["-y", "-i", outputVideo, "-vf", "fps=1,scale=180:240,tile=5x2", "-frames:v", "1", contactSheet], { encoding: "utf8" })

const hashReport = {
  generatedAt: new Date().toISOString(),
  sourcePolicy: "Reference video used only as user taste reference. No frames or audio from it are read by this renderer.",
  referenceVideo: referencePath,
  referenceVideoSha256: hashFile(referencePath),
  outputVideo: outputVideo,
  outputVideoSha256: hashFile(outputVideo),
  musicSource: {
    path: musicPath,
    title: "We Are Electric",
    artist: "Flying Steps / Engelhardt / Wittig / Engin-eer",
    selectionReason: "Real local music with energetic breakbeat/electronic feel; avoids v6 cheap procedural tone. Used as user-local material for this demo.",
    excerptStartSeconds: 38,
  },
  visualSources: [
    { file: assets.elon, source: "Wikimedia Commons Elon Musk public portrait" },
    { file: assets.sam, source: "Wikimedia Commons Sam Altman public portrait" },
    { file: assets.court, source: "Wikimedia Commons courtroom/court source" },
  ],
  outputSpecs: { width: W, height: H, fps: FPS, duration: DURATION },
}
writeFileSync(join(evidenceDir, "hash-report.json"), `${JSON.stringify(hashReport, null, 2)}\n`)
writeFileSync(join(workDir, "README.md"), `# ${outputName}\n\nOfficial AutoDirector v7 render source.\n\n- 9 distinct shot types, not one repeated card.\n- Uses local real music excerpt: ${musicPath}\n- Does not read user reference frames or audio.\n- Output: ${outputVideo}\n`)

console.log(`rendered ${outputVideo}`)
