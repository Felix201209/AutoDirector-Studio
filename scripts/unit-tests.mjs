import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
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
    const forbidden = /(^|\/)(node_modules|\.git|dist|\.tmp|\.autodirector|\.agents|output|intro-site)(\/|$)|\.(mp4|mov|mp3|wav|aiff|ogg|m4a|png|jpg|jpeg|webp|zip|log|pyc|pyo)$/i
    assert.equal(entries.some((entry) => forbidden.test(entry)), false)
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
}

testPathInsideDir()
testArtifactSchema()
testPackageCodeExcludesGeneratedFiles()

console.log("Unit tests passed: path safety, artifact schema, and source ZIP exclusions.")
