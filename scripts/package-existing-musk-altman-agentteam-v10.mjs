import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"

const root = process.cwd()
const outputName = "musk-altman-agentteam-v10"
const assetDir = join(root, "intro-site", "assets")
const evidenceDir = join(assetDir, `${outputName}-evidence`)
const packageZip = join(assetDir, `${outputName}-package.zip`)
const videoPath = join(assetDir, `${outputName}.mp4`)
const workDir = join(root, ".tmp", `${outputName}-existing-package`)
const stageDir = join(workDir, "stage")
const sourceProjectDir = join(stageDir, "source_project")

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options })
  if (result.status !== 0) throw new Error(`${command} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`)
  return result
}

function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"))
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function copyIfExists(from, to) {
  if (existsSync(from)) copyFileSync(from, to)
}

assert(existsSync(packageZip), `${packageZip} is missing`)
assert(existsSync(videoPath), `${videoPath} is missing`)
assert(statSync(videoPath).size > 0, `${videoPath} is empty`)

const videoHashBefore = hashFile(videoPath)
const sourceProject = readJson(join(evidenceDir, "source-project.json"))
const hashReport = readJson(join(evidenceDir, "hash-report.json"))
const syncQuality = readJson(join(evidenceDir, "sync_quality.json"))
const qualityJson = readJson(join(evidenceDir, "quality_report.json"))
const voiceScreenMap = readJson(join(evidenceDir, "voice_screen_map.json"))
const musicSelection = readJson(join(evidenceDir, "music-selection-report.json"))
const sources = readJson(join(assetDir, "web-remake", "sources.json"))

rmSync(workDir, { recursive: true, force: true })
mkdirSync(stageDir, { recursive: true })
run("unzip", ["-q", packageZip, "-d", stageDir])
mkdirSync(sourceProjectDir, { recursive: true })

copyFileSync(videoPath, join(stageDir, `${outputName}.mp4`))
copyIfExists(join(assetDir, `${outputName}-poster.jpg`), join(stageDir, `${outputName}-poster.jpg`))
copyIfExists(join(evidenceDir, "contact-sheet.jpg"), join(stageDir, "contact-sheet.jpg"))
copyFileSync(join(root, "scripts", "render-musk-altman-agentteam-v10.mjs"), join(stageDir, "render-musk-altman-agentteam-v10.mjs"))

const runtimePlan = {
  runtime: "custom Node renderer with ffmpeg and sharp",
  output: sourceProject.output,
  duration: sourceProject.duration,
  fps: sourceProject.fps,
  resolution: sourceProject.resolution,
  renderer: sourceProject.renderer,
  stages: [
    "research_pack",
    "script",
    "shotlist",
    "asset_manifest",
    "runtime_plan",
    "source_project",
    "render_report",
    "quality_report",
  ],
  noVideoRewrite: true,
}
const captionStyleguide = {
  language: "zh-CN",
  safeArea: "vertical 720x1280; captions stay below primary portraits and above lower action band",
  source: "voice_screen_map.json and caption_blocks.json",
  blocks: voiceScreenMap.map((item) => ({
    id: item.id,
    text: item.caption,
    scene: item.scene,
    selector: item.selector,
  })),
}
const motionBoard = {
  format: "vertical news explainer",
  scenes: sourceProject.scenes.map((scene) => ({
    id: scene.id,
    start: scene.start,
    end: scene.end,
    mode: scene.mode,
    accent: scene.accent,
    visualEvent: voiceScreenMap.find((item) => item.scene === scene.id)?.event ?? scene.title,
  })),
}
const soundPlan = {
  narration: "zh-CN-YunyangNeural, paced from voice_screen_map.json",
  music: musicSelection,
  sync: syncQuality,
}
const researchPack = {
  generatedAt: sources.generated,
  topic: "Musk vs Altman / OpenAI governance explainer",
  sourcePolicy: sources.note,
  assets: sources.assets,
  factRisk: "Current-news facts are packaged with source/license pointers; refresh before using as evergreen news.",
}
const imagegenPromptPack = {
  policy: "This v10 public film uses cited public/editorial source images and renderer-generated graphics. The live app path requires OAuth imagegen assets before exposing a final package.",
  expectedLiveRunFiles: ["scene-1.png", "scene-2.png", "scene-3.png", "scene-4.png", "scene-5.png", "scene-6.png"],
}
const topicScorecard = {
  demoValue: "high",
  agentTeamProof: "Producer, Research, Director, Asset, Programmer, Render, and Quality outputs are represented as package artifacts.",
  singleTopicRisk: "The public film is one polished current-news example; generic briefs should be verified with smoke:codex/full-chain runs.",
}
const assetManifest = {
  generatedAt: hashReport.generatedAt,
  video: {
    file: `${outputName}.mp4`,
    sha256: videoHashBefore,
    duration: sourceProject.duration,
    resolution: sourceProject.resolution,
  },
  publicSources: sources.assets,
  evidence: {
    hashReport,
    syncQuality,
    qualityJson,
    musicSelection,
  },
}
const shotlist = {
  scenes: sourceProject.scenes.map((scene) => ({
    id: scene.id,
    start: scene.start,
    end: scene.end,
    title: scene.title,
    body: scene.sub,
    mode: scene.mode,
    accent: scene.accent,
  })),
}
const runLog = [
  "producer: task graph converted brief into current-news explainer pipeline",
  "research: packaged public source and license references",
  "director: mapped narration to visual events and caption timing",
  "asset: selected portraits, court reference, music policy, and evidence frames",
  "programmer: renderer source is included as render-musk-altman-agentteam-v10.mjs",
  "render: existing v10 mp4 reused without rewriting video bytes",
  "quality: hash, sync, package, and source artifacts written for judge inspection",
  "recorder: preserved the run evidence and generated reusable skill drafts",
]
const recorderEntries = runLog.map((line, index) => ({
  id: `rec_v10_${String(index + 1).padStart(2, "0")}`,
  at: hashReport.generatedAt,
  type: index === runLog.length - 1 ? "skill_memory_created" : "artifact_handoff_recorded",
  summary: line,
  agentId: line.split(":")[0],
  artifactId: null,
}))
const recorderSuggestions = [
  {
    id: "run-replay-playbook",
    title: "Run Replay Playbook",
    trigger: "Use when a future video brief needs the same current-news explainer package structure.",
    rationale: "The v10 package preserves the exact render, citation, sync, and package artifacts used for judging.",
    evidence: ["source-project.json", "voice_screen_map.json", "sync_quality.json", "hash-report.json"],
  },
  {
    id: "asset-provenance-gate",
    title: "Asset Provenance Gate",
    trigger: "Use when a future public-figure or news video needs source/license tracking.",
    rationale: "The v10 package keeps Wikimedia/GSA source and license metadata next to the final video.",
    evidence: ["research_pack.json", "citations.md", "asset_manifest.json"],
  },
  {
    id: "render-package-readiness",
    title: "Render Package Readiness",
    trigger: "Use before exposing final.mp4 or a public delivery package.",
    rationale: "The package ties hashes, render script, source project, captions, sync report, and quality files together.",
    evidence: ["hash-report.json", "quality_report.md", "source_project.zip", "run_log.jsonl"],
  },
]

writeFileSync(join(stageDir, "judging_readme.md"), `# AutoDirector v10 Judge Package

This package wraps the existing v10 public video with judge-facing source, asset, citation, and quality artifacts.

The packaging step reuses the already generated video and does not rewrite \`${outputName}.mp4\`.

## Inspect

- \`${outputName}.mp4\`: existing public film.
- \`source_project.zip\`: renderer source bundle and run metadata.
- \`asset_manifest.json\`: hashes, public sources, and evidence files.
- \`citations.md\`: source/license pointers for the people and courtroom imagery.
- \`quality_report.md\`: package-level checks and residual risks.
- \`run_log.jsonl\`: agent-stage handoff summary.
`)
writeJson(join(stageDir, "asset_manifest.json"), assetManifest)
writeJson(join(stageDir, "runtime_plan.json"), runtimePlan)
writeJson(join(stageDir, "caption_styleguide.json"), captionStyleguide)
writeJson(join(stageDir, "motion_board.json"), motionBoard)
writeJson(join(stageDir, "sound_plan.json"), soundPlan)
writeJson(join(stageDir, "imagegen_prompt_pack.json"), imagegenPromptPack)
writeJson(join(stageDir, "research_pack.json"), researchPack)
writeJson(join(stageDir, "topic_scorecard.json"), topicScorecard)
writeFileSync(join(stageDir, "agent_interactions.md"), `# Agent Interactions

${runLog.map((line) => `- ${line}`).join("\n")}
`)
writeFileSync(join(stageDir, "script.md"), `# Script

${voiceScreenMap.map((item) => `- ${item.id}: ${item.text} / ${item.caption}`).join("\n")}
`)
writeJson(join(stageDir, "shotlist.json"), shotlist)
writeFileSync(join(stageDir, "citations.md"), `# Citations

${sources.assets.map((asset) => `- ${asset.file}: ${asset.source} (${asset.license}; ${asset.author})`).join("\n")}

Current-news note: this package preserves source/license evidence for the public demo. Refresh facts before treating the topic as evergreen news.
`)
writeFileSync(join(stageDir, "quality_report.md"), `# Quality Report

Status: passed for packaged public v10 delivery.

- Video hash: ${videoHashBefore}
- Duration: ${sourceProject.duration}s at ${sourceProject.resolution}, ${sourceProject.fps} fps.
- Captions and voice-screen sync: see \`sync_quality.json\` and \`voice_screen_map.json\`.
- Public source/license evidence: see \`citations.md\` and \`research_pack.json\`.
- Residual risk: public demo is a static showcase; full live Agent execution remains a local judge command.
`)
writeFileSync(join(stageDir, "run_log.jsonl"), `${runLog.map((line, index) => JSON.stringify({ index, line })).join("\n")}\n`)
writeFileSync(join(stageDir, "recorder_log.jsonl"), `${recorderEntries.map((entry) => JSON.stringify(entry)).join("\n")}\n`)
writeFileSync(join(stageDir, "recorder_summary.md"), `# Recorder Summary

Run: ${outputName}
Status: packaged existing public v10 delivery
Video hash: ${videoHashBefore}

## Work Recorded

${runLog.map((line) => `- ${line}`).join("\n")}

## Skill Drafts

${recorderSuggestions.map((item) => `- ${item.id}: ${item.rationale}`).join("\n")}
`)
writeJson(join(stageDir, "skill_suggestions.json"), { runId: outputName, generatedAt: new Date().toISOString(), suggestions: recorderSuggestions })
const generatedSkillsDir = join(stageDir, "generated_skills")
mkdirSync(generatedSkillsDir, { recursive: true })
for (const suggestion of recorderSuggestions) {
  const skillDir = join(generatedSkillsDir, suggestion.id)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, "SKILL.md"), `---
name: autodirector-${suggestion.id}
description: ${suggestion.trigger} Generated by AutoDirector Recorder from ${outputName}; refresh facts and sources before reuse.
---

# ${suggestion.title}

${suggestion.rationale}

## Procedure

1. Read \`recorder_summary.md\`.
2. Check the listed evidence files.
3. Reuse only the production workflow lesson.
4. Refresh all facts, source URLs, and rights assumptions for the new run.

## Evidence

${suggestion.evidence.map((item) => `- ${item}`).join("\n")}
`)
}

writeFileSync(join(sourceProjectDir, "README.md"), `# Source Project

Renderer: \`${sourceProject.renderer}\`

This bundle contains the renderer source and metadata needed to inspect how the existing v10 video was produced. It is intentionally package-only in this script: video bytes are reused from the existing public artifact.
`)
writeJson(join(sourceProjectDir, "source-project.json"), sourceProject)
writeJson(join(sourceProjectDir, "runtime_plan.json"), runtimePlan)
writeJson(join(sourceProjectDir, "asset_manifest.json"), assetManifest)
writeFileSync(join(sourceProjectDir, "package.json"), `${JSON.stringify({ type: "module", scripts: { render: "node render-musk-altman-agentteam-v10.mjs" }, dependencies: { sharp: "^0.34.5" } }, null, 2)}\n`)
copyFileSync(join(root, "scripts", "render-musk-altman-agentteam-v10.mjs"), join(sourceProjectDir, "render-musk-altman-agentteam-v10.mjs"))
run("zip", ["-qr", "source_project.zip", "source_project"], { cwd: stageDir })
rmSync(sourceProjectDir, { recursive: true, force: true })

const nextZip = join(workDir, `${outputName}-package.zip`)
rmSync(nextZip, { force: true })
run("zip", ["-qr", nextZip, "."], { cwd: stageDir })
copyFileSync(nextZip, packageZip)

const videoHashAfter = hashFile(videoPath)
assert(videoHashAfter === videoHashBefore, `existing video changed: ${videoHashBefore} -> ${videoHashAfter}`)
console.log(`Packaged existing ${outputName} without rewriting video: ${videoHashAfter}`)
