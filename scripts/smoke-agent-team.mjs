import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const port = Number(process.env.AGENT_TEAM_SMOKE_PORT ?? 8793)
const baseUrl = `http://127.0.0.1:${port}`
const stateDir = mkdtempSync(join(tmpdir(), "autodirector-agent-team-"))
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAwUBAWjz5xUAAAAASUVORK5CYII=", "base64")

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs ?? 180_000),
  })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

async function waitForServer() {
  const started = Date.now()
  while (Date.now() - started < 15_000) {
    try {
      const response = await fetch(`${baseUrl}/api/bootstrap`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error("server did not become ready")
}

function writeImagegenAssets(runId, count) {
  const assetDir = join(root, "output", "imagegen", runId)
  mkdirSync(assetDir, { recursive: true })
  for (let index = 1; index <= count; index += 1) {
    writeFileSync(join(assetDir, `scene-${index}.png`), tinyPng)
  }
  return assetDir
}

async function submitWorkingArtifact(run, expected) {
  const task = run.tasks.find((item) => item.status === "working")
  assert(task, `missing working task for ${expected.stepId}`)
  assert(
    task.stepId === expected.stepId && task.agentId === expected.agentId && task.outputId === expected.outputId,
    `expected ${expected.stepId}/${expected.agentId}/${expected.outputId}, got ${task.stepId}/${task.agentId}/${task.outputId}`
  )
  const response = await fetchJson(`/api/runs/${run.id}/agent-artifact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      taskId: task.id,
      agentId: task.agentId,
      artifact: {
        title: `${task.label} smoke artifact`,
        type: expected.type ?? "json",
        summary: `${task.agentId} completed ${task.outputId}; handoff recorded through the real artifact endpoint.`,
        content: {
          status: "passed",
          stepId: task.stepId,
          agentId: task.agentId,
          outputId: task.outputId,
          inputArtifactIds: task.inputArtifactIds,
        },
        checks: ["working task matched", "artifact persisted", "handoff advanced"],
      },
    }),
  })
  const next = response.activeRun
  console.log(`agent-team: ${expected.agentId} -> ${expected.outputId} (${next.completedSteps}/9)`)
  return next
}

async function main() {
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      AUTODIRECTOR_STATE_DIR: stateDir,
      AUTODIRECTOR_PUBLIC_ORIGIN: baseUrl,
      AUTODIRECTOR_OFFLINE_SMOKE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let stderr = ""
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString()
  })

  try {
    await waitForServer()
    const bootstrap = await fetchJson("/api/bootstrap")
    const requiredAgents = ["producer", "research", "director", "asset", "programmer", "render", "quality", "recorder"]
    const workerIds = new Set(bootstrap.workers?.map((worker) => worker.id))
    for (const agentId of requiredAgents) assert(workerIds.has(agentId), `missing ${agentId} worker`)
    assert(bootstrap.pipeline?.length === 9, `expected 9-step pipeline, got ${bootstrap.pipeline?.length}`)

    await fetchJson("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentHost: "codex_plugin",
        modelProvider: "codex_oauth",
        visualProvider: "codex_imagegen",
        defaultRuntime: "hyperframes",
        layoutMode: "simple",
        executionMode: "oauth_agents",
      }),
    })

    const created = await fetchJson("/api/generate-one-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief: "Agent Team smoke: launch a vertical product explainer from one brief." }),
    })
    let run = created.activeRun
    assert(run?.id, "run was not created")
    assert(run.status === "active", `run should wait for real agent artifacts, got ${run.status}`)
    assert(run.tasks.find((task) => task.status === "working")?.agentId === "producer", "first task was not assigned to Producer")

    const sceneCount = 5
    const assetDir = writeImagegenAssets(run.id, sceneCount)
    const registered = await fetchJson(`/api/runs/${run.id}/register-image-assets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetDir }),
    })
    run = registered.activeRun
    assert(run.imageAssetDir?.endsWith(`/output/imagegen/${run.id}`), "imagegen asset directory was not registered")

    const chain = [
      ["brief", "producer", "task_graph"],
      ["research", "research", "research_pack"],
      ["script", "director", "script"],
      ["director", "director", "shotlist"],
      ["asset", "asset", "asset_manifest"],
      ["runtime", "programmer", "runtime_plan"],
      ["programmer", "programmer", "source_project"],
      ["render", "render", "render_report"],
      ["quality", "quality", "quality_report"],
    ].map(([stepId, agentId, outputId]) => ({ stepId, agentId, outputId }))

    for (const expected of chain) {
      run = await submitWorkingArtifact(run, expected)
    }

    const finalRun = await fetchJson(`/api/runs/${run.id}`)
    assert(finalRun.status === "final", `run should be final, got ${finalRun.status}`)
    assert(finalRun.completedSteps === chain.length, `completed ${finalRun.completedSteps}/${chain.length}`)
    assert(finalRun.package?.status === "ready", `package should be ready, got ${finalRun.package?.status}`)
    assert(finalRun.package?.finalVideoUrl?.endsWith("/final.mp4"), "final package missing final.mp4")
    assert(finalRun.artifacts?.some((artifact) => artifact.id === "recorder_memory"), "Recorder memory artifact missing")
    assert(finalRun.recorder?.entries?.length >= chain.length, "Recorder did not capture agent handoffs")
    for (const required of ["agent_interactions.md", "quality_report.md", "run_log.jsonl", "recorder_log.jsonl", "source_project.zip"]) {
      assert(finalRun.package.files?.includes(required), `package missing ${required}`)
    }
    const finalVideo = join(stateDir, "runs", finalRun.id, "final-package", "final.mp4")
    assert(existsSync(finalVideo) && statSync(finalVideo).size > 1000, "final.mp4 was not written")
    console.log(`Agent Team smoke passed: ${finalRun.id}`)
  } finally {
    server.kill()
    rmSync(stateDir, { recursive: true, force: true })
    if (process.exitCode && stderr) console.error(stderr)
  }
}

main().catch((error) => {
  console.error(`Agent Team smoke failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
