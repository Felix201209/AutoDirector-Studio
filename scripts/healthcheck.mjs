import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const publicUrl = process.env.AUTODIRECTOR_PUBLIC_URL ?? "https://autodirector.felixypz.me"

async function fetchText(url) {
  const response = await fetchWithRetry(url)
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.text()
}

async function fetchHead(url, expectedType) {
  const response = await fetchWithRetry(url, { method: "HEAD" })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  const type = response.headers.get("content-type") ?? ""
  if (expectedType && !type.includes(expectedType)) {
    throw new Error(`${url} returned content-type ${type}, expected ${expectedType}`)
  }
  return {
    status: response.status,
    type,
    length: response.headers.get("content-length") ?? "unknown",
  }
}

async function fetchBinary(url, expectedType) {
  const response = await fetchWithRetry(url)
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  const type = response.headers.get("content-type") ?? ""
  if (expectedType && !type.includes(expectedType)) {
    throw new Error(`${url} returned content-type ${type}, expected ${expectedType}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function fetchWithRetry(url, options = {}) {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await fetch(url, options)
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, attempt * 700))
    }
  }
  throw lastError
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertNoPatterns(body, label, patterns) {
  for (const pattern of patterns) {
    assert(!pattern.test(body), `${label} should not match ${pattern}`)
  }
}

function collectTextFiles(root, files = []) {
  if (!existsSync(root)) return files
  const stat = statSync(root)
  if (stat.isFile()) {
    if (/\.(css|html|js|json|md|mjs|py|ts|tsx|txt|vtt)$/.test(root)) files.push(root)
    return files
  }
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    if (
      /(^|\/)(node_modules|dist|\.tmp|\.autodirector|control-ui|assets)$/.test(path) ||
      path.endsWith(join("intro-site", "delivery.html"))
    ) {
      continue
    }
    collectTextFiles(path, files)
  }
  return files
}

const localUsersPrefix = ["/", "Users", "/"].join("")
const localUserPath = [localUsersPrefix, "felix"].join("")
const localEmailUser = ["f120", "927"].join("")
const outlookDomainNeedle = ["@", "outlook"].join("")
const secretNeedles = [localUserPath, localUsersPrefix, localEmailUser, outlookDomainNeedle]
const staticCssVersion = "styles.css?v=20260504ambientfit"
const nonDeliveryStaticPages = ["index.html", "team.html", "pipeline.html", "details.html", "control-room.html"]
const staticNavPages = ["index.html", "team.html", "pipeline.html", "details.html"]
const localizedStaticNavLabels = ["Agent 团队", "生产线", "控制台", "细节", "交付"]
const controlUiDirectViewLinks = [
  "control-ui/?view=orchestrate",
  "control-ui/?view=agents",
  "control-ui/?view=delivery",
  "control-ui/?view=settings",
]
const staleStaticEnglishPatterns = [
  /Watch demo/,
  /\bControl UI\b/,
  /\bInteractive Pipeline\b/,
  /\bWorkflow Details\b/,
  />Delivery</,
  /Read-only Control UI/,
]
const controlUiPolishNeedles = [
  "持久在线制作团队",
  "个 Agent",
  "视频交付室",
  "账号 / Agent / 素材",
  "Agent 接入方式",
  "Musk vs Altman v10",
  "流水线时间轴",
  "工具控制台",
]
const staleControlUiCopyPatterns = [
  /正式通过 AutoDirector Agent Team/,
  /Pipeline Timeline/,
  /Tool Console/,
  /Terminal Setup/,
  /Enter Control Room/,
  /Blocked before render/,
  /Producer Plan/,
  /Artifact Handoff/,
  /持久在线的视频制作 workers/,
  /个 worker/,
  /谁来当 Producer 和 workers/,
  /等待 worker 输出/,
  /Worker 收件箱/,
  /没点 Start production 前，worker/,
  /Producer created task_graph and acceptance criteria/,
  /Workers completed artifact handoff trail/,
]
const uiStyleAntiPatterns = [
  /transition:\s*all/i,
  /outline:\s*none/i,
  /outline-none/i,
  /font-size:\s*clamp\([^;]*(?:vw|vh|vmin|vmax)/i,
  /letter-spacing:\s*-/i,
]
const builtCssAntiPatterns = uiStyleAntiPatterns.filter((pattern) => pattern.source !== "outline-none")
const wordFromCodes = (codes) => codes.map((code) => String.fromCharCode(code)).join("")
const oldQualityInitials = wordFromCodes([81, 65])
const oldAcceptanceWord = wordFromCodes([39564, 25910])
const oldChineseInspectionWord = wordFromCodes([23457, 26597])
const oldReviewAgentWord = ["Review", " Agent"].join("")
const oldReviewWord = ["rev", "iew"].join("")
const oldApprovalWord = ["appro", "val"].join("")
const oldAcceptanceAsciiWord = ["accept", "ance"].join("")
const oldQualityFilePrefix = oldQualityInitials.toLowerCase()
const oldProducerInstruction = ["Instruct", " the Producer"].join("")
const oldFinalReady = ["Final", " Ready"].join("")
const legacyReviewPatterns = [
  new RegExp(`\\b${oldQualityInitials}\\b`),
  new RegExp(`${oldQualityInitials} 报告`),
  new RegExp(`${oldQualityInitials} ${oldAcceptanceWord}`),
  new RegExp(`${oldQualityInitials} report`, "i"),
  new RegExp(`${oldQualityInitials} gates?`, "i"),
  new RegExp(`${oldQualityInitials} Director`, "i"),
  new RegExp(`${oldQualityInitials} Agent`, "i"),
  new RegExp(oldAcceptanceWord),
  new RegExp(oldChineseInspectionWord),
  new RegExp(oldReviewAgentWord, "i"),
  new RegExp(oldProducerInstruction),
  new RegExp(oldFinalReady),
]
const legacyZipEntryPatterns = [
  new RegExp(`(^|/)${oldQualityFilePrefix}[-_.]`, "i"),
  new RegExp(`[_-]${oldQualityFilePrefix}([._-]|$)`, "i"),
  new RegExp(oldReviewWord, "i"),
  new RegExp(oldApprovalWord, "i"),
  new RegExp(oldAcceptanceAsciiWord, "i"),
]

function assertLocalizedStaticNav(html, label) {
  for (const navLabel of localizedStaticNavLabels) {
    assert(html.includes(navLabel), `${label} should include localized nav label ${navLabel}`)
  }
  assert(html.includes("control-ui/"), `${label} should link to the read-only control UI`)
  assertNoPatterns(html, label, staleStaticEnglishPatterns)
}

function assertControlUiPolish(body, label) {
  for (const needle of controlUiPolishNeedles) {
    assert(body.includes(needle), `${label} should include polished Control UI copy: ${needle}`)
  }
  assertNoPatterns(body, label, staleControlUiCopyPatterns)
}

function assertControlUiDirectEntries(html, label) {
  for (const href of controlUiDirectViewLinks) {
    assert(html.includes(`href="${href}"`), `${label} should expose direct Control UI entry ${href}`)
  }
}

function assertHomeDemoPresent(html, label) {
  assert(html.includes('id="demo"'), `${label} should expose the homepage video demo anchor`)
  assert(html.includes('id="intro-video"'), `${label} should include the intro video player`)
  assert(html.includes("assets/autodirector-intro-edge.mp4"), `${label} should point at the intro demo video`)
  assert(!html.includes("只读 Web UI Demo"), `${label} should not show the removed fake Web UI demo`)
  assert(!html.includes("公网 demo 禁止输入"), `${label} should not include removed demo-only copy`)
  assert(html.includes("control-ui/"), `${label} should link to the 1:1 read-only Control UI`)
}

function assertZipClean(zipPath, requiredFiles = []) {
  const unzip = spawnSync("unzip", ["-l", zipPath], { encoding: "utf8" })
  if (unzip.status !== 0) throw new Error(unzip.stderr || unzip.stdout || `unzip failed for ${zipPath}`)
  const zipinfo = spawnSync("zipinfo", ["-1", zipPath], { encoding: "utf8" })
  if (zipinfo.status !== 0) throw new Error(zipinfo.stderr || zipinfo.stdout || `zipinfo failed for ${zipPath}`)
  const entries = zipinfo.stdout.split(/\r?\n/).filter(Boolean)
  for (const required of requiredFiles) {
    assert(entries.includes(required), `${zipPath} is missing ${required}`)
  }
  for (const entry of entries) {
    assert(!/\.DS_Store|__MACOSX/.test(entry), `${zipPath} should not include macOS metadata files`)
    assert(!legacyZipEntryPatterns.some((pattern) => pattern.test(entry)), `${zipPath} should not include legacy audit-style entry ${entry}`)
  }
  for (const secret of secretNeedles) {
    const scan = spawnSync("zipgrep", ["-n", secret, zipPath], { encoding: "utf8" })
    if (scan.status === 0) throw new Error(`${zipPath} should not expose ${secret}:\n${scan.stdout}`)
    if (scan.status !== 1) throw new Error(scan.stderr || scan.stdout || `zipgrep failed while scanning ${zipPath}`)
  }
}

const localHome = readFileSync(join("intro-site", "index.html"), "utf8")
assert(localHome.includes("AutoDirector"), "local static homepage is missing AutoDirector copy")
assertHomeDemoPresent(localHome, "local static homepage")
assertControlUiDirectEntries(localHome, "local homepage")

for (const page of nonDeliveryStaticPages) {
  const html = readFileSync(join("intro-site", page), "utf8")
  assert(html.includes(staticCssVersion), `local ${page} should load ${staticCssVersion}`)
  assertNoPatterns(html, `local ${page}`, legacyReviewPatterns)
}
for (const page of staticNavPages) {
  assertLocalizedStaticNav(readFileSync(join("intro-site", page), "utf8"), `local ${page}`)
}
const localControlRedirect = readFileSync(join("intro-site", "control-room.html"), "utf8")
assert(localControlRedirect.includes("作品展示入口"), "local control-room redirect should use Chinese showcase wording")
assertNoPatterns(localControlRedirect, "local control-room redirect", staleStaticEnglishPatterns)

for (const cssFile of ["src/index.css", "intro-site/styles.css", "intro-site/hero-video/index.html"]) {
  assertNoPatterns(readFileSync(cssFile, "utf8"), cssFile, uiStyleAntiPatterns)
}

for (const textFile of [
  ...collectTextFiles("docs"),
  ...collectTextFiles("plugins/autodirector-codex"),
  ...collectTextFiles("server"),
  ...collectTextFiles("src"),
  ...collectTextFiles("intro-site"),
]) {
  assertNoPatterns(readFileSync(textFile, "utf8"), textFile, legacyReviewPatterns)
}

assertControlUiPolish(readFileSync(join("src", "App.tsx"), "utf8"), "src/App.tsx")

const publicHome = await fetchText(`${publicUrl}/`)
assert(publicHome.includes("AutoDirector"), "public static homepage is missing AutoDirector copy")
assertHomeDemoPresent(publicHome, "public static homepage")
assert(!publicHome.includes("/api/"), "public homepage should not link to backend API")
assert(!publicHome.includes("autodirector-source.zip"), "public homepage should not expose WebUI source ZIP")
assert(publicHome.includes(staticCssVersion), `public homepage should load ${staticCssVersion}`)
assertNoPatterns(publicHome, "public homepage", legacyReviewPatterns)
assertLocalizedStaticNav(publicHome, "public homepage")
assertControlUiDirectEntries(publicHome, "public homepage")

for (const page of ["team.html", "pipeline.html", "details.html", "delivery.html"]) {
  const html = await fetchText(`${publicUrl}/${page}`)
  assert(html.includes("AutoDirector"), `public ${page} is missing AutoDirector copy`)
  assert(!html.includes("/api/"), `public ${page} should not link to backend API`)
  if (page !== "delivery.html") {
    assert(html.includes(staticCssVersion), `public ${page} should load ${staticCssVersion}`)
    assertNoPatterns(html, `public ${page}`, legacyReviewPatterns)
    assertLocalizedStaticNav(html, `public ${page}`)
  }
}

const publicControlUi = await fetchText(`${publicUrl}/control-ui/`)
assert(publicControlUi.includes("AutoDirector Control Room"), "public control-ui is missing the React control room shell")
assert(publicControlUi.includes("/control-ui/assets/"), "public control-ui is missing built asset links")
assert(!publicControlUi.includes("/api/"), "public control-ui HTML should not link to backend API")
const publicControlAssets = [...publicControlUi.matchAll(/(?:src|href)="([^"]*\/control-ui\/assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1])
const publicControlJsAssets = publicControlAssets.filter((asset) => asset.endsWith(".js"))
const publicControlCssAssets = publicControlAssets.filter((asset) => asset.endsWith(".css"))
assert(publicControlJsAssets.length > 0, "public control-ui should include a built JS asset")
assert(publicControlCssAssets.length > 0, "public control-ui should include a built CSS asset")
for (const asset of publicControlJsAssets) {
  const body = await fetchText(new URL(asset, `${publicUrl}/`).toString())
  assert(!/\/api\//.test(body), `${asset} should not contain backend API calls in the public read-only bundle`)
  assertNoPatterns(body, asset, legacyReviewPatterns)
  assertControlUiPolish(body, asset)
}
for (const asset of publicControlCssAssets) {
  const body = await fetchText(new URL(asset, `${publicUrl}/`).toString())
  assertNoPatterns(body, asset, builtCssAntiPatterns)
}

const controlRedirect = await fetchText(`${publicUrl}/control-room.html`)
assert(controlRedirect.includes("control-ui/"), "public control-room redirect should point to control-ui/")
assert(controlRedirect.includes("作品展示入口"), "public control-room redirect should use Chinese showcase wording")
assert(controlRedirect.includes(staticCssVersion), `public control-room redirect should load ${staticCssVersion}`)
assertNoPatterns(controlRedirect, "public control-room redirect", legacyReviewPatterns)
assertNoPatterns(controlRedirect, "public control-room redirect", staleStaticEnglishPatterns)

const apiProbe = await fetchWithRetry(`${publicUrl}/api/bootstrap`)
assert(apiProbe.status === 404, `public /api/bootstrap should be unavailable on static demo, got ${apiProbe.status}`)
for (const blocked of ["autodirector-source.zip", "autodirector-code.zip"]) {
  const probe = await fetchWithRetry(`${publicUrl}/assets/${blocked}`, { method: "HEAD" })
  assert(probe.status === 404, `public ${blocked} should not be exposed, got ${probe.status}`)
}

const publicFilmName = "musk-altman-agentteam-v10.mp4"
const publicPackageName = "musk-altman-agentteam-v10-package.zip"
const publicPackageHref = `assets/${publicPackageName}`
const deliveryPage = await fetchText(`${publicUrl}/delivery.html`)
assert(deliveryPage.includes(`assets/${publicFilmName}`), "public delivery page does not point at the current v10 film")
assert(deliveryPage.includes(publicPackageHref), "public delivery page does not point at the v10 package URL")
const finalVideo = await fetchHead(`${publicUrl}/assets/${publicFilmName}`, "video/mp4")
const publicPackageUrl = new URL(publicPackageHref, `${publicUrl}/`).toString()
const finalZip = await fetchHead(publicPackageUrl, "application/zip")

const zipPath = join("intro-site", "assets", publicPackageName)
assert(existsSync(zipPath), `${zipPath} does not exist`)
const requiredPackageFiles = [
  "hash-report.json",
  "source-project.json",
  "quality_report.json",
  "sync_quality.json",
  "voice_screen_map.json",
  "music-selection-report.json",
  "render-musk-altman-agentteam-v10.mjs",
  publicFilmName,
]
assertZipClean(zipPath, requiredPackageFiles)

const publicPackageTempDir = mkdtempSync(join(tmpdir(), "autodirector-public-package-"))
try {
  const publicPackagePath = join(publicPackageTempDir, publicPackageName)
  writeFileSync(publicPackagePath, await fetchBinary(publicPackageUrl, "application/zip"))
  assertZipClean(publicPackagePath, requiredPackageFiles)
} finally {
  rmSync(publicPackageTempDir, { recursive: true, force: true })
}

const ffprobe = spawnSync(
  "ffprobe",
  ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", join("intro-site", "assets", publicFilmName)],
  { encoding: "utf8" }
)
if (ffprobe.status !== 0) throw new Error(ffprobe.stderr || "ffprobe failed for public final film")
const media = JSON.parse(ffprobe.stdout)
const videoStream = media.streams?.find((stream) => Number(stream.width) > 0 && Number(stream.height) > 0)
const duration = Number(media.format?.duration)
assert(videoStream?.width === 720 && videoStream?.height === 1280, `public final film should be 720x1280 vertical v10, got ${videoStream?.width}x${videoStream?.height}`)
assert(duration >= 28 && duration <= 34, `public final film should stay near the 30s hackathon demo target, got ${duration.toFixed(1)}s`)

console.log("AutoDirector healthcheck passed")
console.log("mode: static public demo, no backend API")
console.log(`final film: ${finalVideo.status} ${finalVideo.type} ${finalVideo.length} (${videoStream.width}x${videoStream.height}, ${duration.toFixed(1)}s)`)
console.log(`final package: ${finalZip.status} ${finalZip.type} ${finalZip.length}`)
