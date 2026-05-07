import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function checkSyntax(file) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${file} syntax check failed`)
}

function zipEntries(zipPath) {
  const result = spawnSync("zipinfo", ["-1", zipPath], { encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `zipinfo failed for ${zipPath}`)
  return result.stdout.split(/\r?\n/).filter(Boolean)
}

for (const file of ["server/index.mjs", "server/codex-native-agents.mjs", "server/codex-app-server.mjs", "scripts/package-code.mjs"]) {
  checkSyntax(file)
}

if (existsSync("intro-site")) {
  for (const page of ["intro-site/index.html", "intro-site/team.html", "intro-site/pipeline.html", "intro-site/details.html", "intro-site/delivery.html", "intro-site/control-room.html"]) {
    assert(existsSync(page), `${page} is missing`)
    const html = readFileSync(page, "utf8")
    assert(html.includes("AutoDirector"), `${page} is missing AutoDirector copy`)
  }

  const home = readFileSync("intro-site/index.html", "utf8")
  for (const navLabel of ["Agent 团队", "生产线", "控制台", "细节", "交付"]) {
    assert(home.includes(navLabel), `homepage should include localized nav label ${navLabel}`)
  }
  assert(home.includes('id="demo"'), "homepage should keep the hero video demo anchor")
  assert(home.includes('id="intro-video"'), "homepage should keep the intro video player")
  assert(home.includes("assets/autodirector-intro-edge.mp4"), "homepage should point at the intro demo video")
  assert(!home.includes("Watch demo"), "homepage nav action should be localized")

  const details = readFileSync("intro-site/details.html", "utf8")
  assert(details.includes("失败不是结束"), "details page should show the patch loop")
  assert(details.includes("局部修复"), "details page should explain local repair")

  const delivery = readFileSync("intro-site/delivery.html", "utf8")
  assert(delivery.includes("30 秒旁白脚本"), "delivery page should include transcript")
  assert(delivery.includes("场景和画面事件"), "delivery page should include scene list")
  assert(delivery.includes("素材和证据怎么审"), "delivery page should include source evidence")

  const manifest = JSON.parse(readFileSync("intro-site/demo-manifest.json", "utf8"))
  assert(manifest.publicShowcaseUrl === "https://autodirector.felixypz.me/", "demo manifest has wrong showcase URL")
  assert(manifest.publicDemoAssets?.finalVideo?.url?.endsWith("/assets/musk-altman-agentteam-v10.mp4"), "demo manifest missing final video URL")
  assert(manifest.publicDemoAssets?.deliveryPackage?.url?.endsWith("/assets/musk-altman-agentteam-v10-package.zip"), "demo manifest missing package URL")
}

const generalExample = JSON.parse(readFileSync("examples/smart-water-bottle/brief.json", "utf8"))
assert(generalExample.brief?.includes("smart water bottle"), "general example brief is missing expected product prompt")
assert(generalExample.requiredPipelineChecks?.length >= 6, "general example should exercise the Agent pipeline")

const packageResult = spawnSync(process.execPath, ["scripts/package-code.mjs"], { encoding: "utf8" })
if (packageResult.status !== 0) throw new Error(packageResult.stderr || packageResult.stdout || "package-code failed")

const entries = zipEntries("autodirector-code.zip")
for (const required of [
  "JUDGE_GUIDE.md",
  "README.md",
  "package.json",
  "src/App.tsx",
  "server/index.mjs",
  "server/artifact-schema.mjs",
  "server/security-utils.mjs",
  "scripts/unit-tests.mjs",
  "plugins/autodirector-codex/README.md",
  "examples/smart-water-bottle/brief.json",
]) {
  assert(entries.includes(required), `autodirector-code.zip is missing ${required}`)
}
const forbidden = /(^|\/)(node_modules|\.git|dist|\.tmp|\.autodirector|\.agents|output|intro-site)(\/|$)|\.(mp4|mov|mp3|wav|aiff|ogg|m4a|png|jpg|jpeg|webp|zip|log|pyc|pyo)$|(^|\/)\.env($|\.local$|\.development$|\.production$|\.test$)/i
for (const entry of entries) {
  assert(!forbidden.test(entry), `autodirector-code.zip contains forbidden entry ${entry}`)
}

console.log(`Local healthcheck passed: ${entries.length} source ZIP entries, no public-network dependency.`)
