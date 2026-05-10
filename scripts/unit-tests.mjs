import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { normalizeAgentArtifact } from "../server/artifact-schema.mjs"
import { isPathInsideDir } from "../server/security-utils.mjs"

function testPathInsideDir() {
  const base = resolve("/tmp/autodirector-safe")
  assert.equal(isPathInsideDir(base, base), true)
  assert.equal(isPathInsideDir(join(base, "scene-1.png"), base), true)
  assert.equal(isPathInsideDir(join(base, "nested", "scene-2.png"), base), true)
  assert.equal(isPathInsideDir("/tmp/autodirector-safe-neighbor/scene.png", base), false)
  assert.equal(isPathInsideDir("/tmp/other/scene.png", base), false)
  assert.equal(isPathInsideDir(join(base, "..", "other", "scene.png"), base), false)
}

function testDemoManifest() {
  const manifestPath = "intro-site/demo-manifest.json"
  if (!existsSync(manifestPath)) return
  const manifest = JSON.parse(spawnSync("node", ["-e", `process.stdout.write(require('fs').readFileSync(${JSON.stringify(manifestPath)}, 'utf8'))`], { encoding: "utf8" }).stdout)
  assert.equal(manifest.publicShowcaseUrl, "https://autodirector.felixypz.me/")
  assert.match(manifest.publicDemoAssets.finalVideo.url, /musk-altman-agentteam-v10\.mp4$/)
  assert.match(manifest.publicDemoAssets.deliveryPackage.url, /musk-altman-agentteam-v10-package\.zip$/)
  assert.equal(Array.isArray(manifest.sourceZip.verificationCommands), true)
  assert.equal("judgeCommands" in manifest.sourceZip, false)
}

function testPublicPluginMetadata() {
  const plugin = JSON.parse(readFileSync("plugins/autodirector-codex/.codex-plugin/plugin.json", "utf8"))
  const urls = [
    plugin.homepage,
    plugin.author?.url,
    plugin.interface?.websiteURL,
    plugin.interface?.privacyPolicyURL,
    plugin.interface?.termsOfServiceURL,
  ]
  for (const url of urls) {
    assert.equal(typeof url, "string")
    assert.match(url, /^https:\/\//)
    assert.doesNotMatch(url, /localhost|127\.0\.0\.1|autodirector\.local|easyclaw\.link/i)
  }
}

function testGeneralExampleEvidencePlan() {
  const plan = JSON.parse(readFileSync("examples/smart-water-bottle/evidence-plan.json", "utf8"))
  assert.equal(plan.input, "examples/smart-water-bottle/brief.json")
  assert.equal(plan.expectedArtifacts.length, 7)
  assert.deepEqual(plan.expectedArtifacts.map((item) => item.agentId), [
    "producer",
    "research",
    "director",
    "asset",
    "programmer",
    "render",
    "quality",
  ])
  assert(plan.qualityGate.allowPackageWhen.length >= 4)
  assert(plan.qualityGate.blockPackageWhen.length >= 4)
}

function testHealthcheckHasGenericSecretScanning() {
  const healthcheck = readFileSync("scripts/healthcheck.mjs", "utf8")
  assert.doesNotMatch(healthcheck, /localUsersPrefix|localUserPath|localEmailUser|outlookDomainNeedle/)
  assert.doesNotMatch(healthcheck, /f120|927/)
  assert.match(healthcheck, /homedir\(\)/)
  assert.match(healthcheck, /secretPatterns/)
}

function testReviewRiskRegressionsStayClosed() {
  const coreServer = readFileSync("server/index.mjs", "utf8")
  const app = readFileSync("src/App.tsx", "utf8")
  const nativeAgents = readFileSync("server/codex-native-agents.mjs", "utf8")
  assert.doesNotMatch(`${coreServer}\n${app}\n${nativeAgents}`, /3c463363/)
  assert.doesNotMatch(app, /qwen-chat|OpenAI 默认模型/)
  assert.match(app, /GPT-5\.5/)
  assert.doesNotMatch(coreServer, /马斯克|奥特曼|Elon Musk|Sam Altman|news_musk|news_altman|musk_altman_news/)
  assert.match(coreServer, /isPathInsideDir\(candidate, rootDir\)/)
  assert.match(coreServer, /AUTODIRECTOR_HYPERFRAMES_SKILL_DIR/)
  assert.match(coreServer, /createCipheriv/)
  assert.match(coreServer, /cloneStateForDisk/)
  assert.match(coreServer, /hydrateStateFromDisk/)
  assert.match(coreServer, /openAiSecretFields = \["accessToken", "refreshToken", "idToken"\]/)
  assert.match(coreServer, /callExternalTextAdapter/)
  assert.match(coreServer, /callOpenAiCompatibleAdapter/)
  assert.match(coreServer, /callAnthropicAdapter/)
  assert.match(coreServer, /DEEPSEEK_API_KEY/)
  assert.match(coreServer, /DASHSCOPE_API_KEY/)
  assert.match(app, /ANTHROPIC_API_KEY/)
  assert.match(app, /CUSTOM_MODEL_BASE_URL/)
}

function testArtifactSchema() {
  const artifact = normalizeAgentArtifact({
    run: { id: "run_test" },
    task: {
      id: "task_script",
      agentId: "director",
      outputId: "script",
      inputArtifactIds: ["research_pack"],
    },
    body: {
      title: "Script",
      type: "json",
      summary: "Short script artifact",
      checks: ["caption safe", "runtime target clear"],
      blockingIssues: ["needs image assets"],
      nextAgentHints: ["Asset should create scene plates"],
    },
    template: ["Script", "json", "Agent script"],
    path: "/tmp/script.json",
    createdAt: "2026-05-04T00:00:00.000Z",
  })
  assert.equal(artifact.schemaVersion, "1.0")
  assert.equal(artifact.runId, "run_test")
  assert.equal(artifact.taskId, "task_script")
  assert.equal(artifact.agentId, "director")
  assert.deepEqual(artifact.inputArtifactIds, ["research_pack"])
  assert.deepEqual(artifact.qualityChecks, ["caption safe", "runtime target clear"])
  assert.deepEqual(artifact.blockingIssues, ["needs image assets"])
  assert.deepEqual(artifact.nextAgentHints, ["Asset should create scene plates"])
}

function testPackageCodeExcludesGeneratedFiles() {
  const sandbox = mkdtempSync(join(tmpdir(), "autodirector-unit-"))
  try {
    const result = spawnSync(process.execPath, ["scripts/package-code.mjs"], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    const zipinfo = spawnSync("zipinfo", ["-1", "autodirector-code.zip"], { encoding: "utf8" })
    assert.equal(zipinfo.status, 0, zipinfo.stderr || zipinfo.stdout)
    const entries = zipinfo.stdout.split(/\r?\n/).filter(Boolean)
    assert(entries.includes("JUDGE_GUIDE.md"))
    assert(entries.includes("examples/smart-water-bottle/brief.json"))
    assert(entries.includes("docs/agent-skills/recorder.md"))
    assert(entries.includes("plugins/autodirector-codex/skills/recorder/SKILL.md"))
    assert.equal(entries.some((entry) => entry.startsWith("intro-site/")), false)
    const forbidden = /(^|\/)(node_modules|\.git|dist|\.tmp|\.autodirector|\.agents|output|scripts\/archive|intro-site)(\/|$)|\.(mp4|mov|mp3|wav|aiff|ogg|m4a|png|jpg|jpeg|webp|zip|log|pyc|pyo)$/i
    assert.equal(entries.some((entry) => forbidden.test(entry)), false)
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
}

testPathInsideDir()
testDemoManifest()
testPublicPluginMetadata()
testGeneralExampleEvidencePlan()
testHealthcheckHasGenericSecretScanning()
testReviewRiskRegressionsStayClosed()
testArtifactSchema()
testPackageCodeExcludesGeneratedFiles()

console.log("Unit tests passed: path safety, public metadata, healthcheck guardrails, artifact schema, demo manifest, and source ZIP boundary.")
