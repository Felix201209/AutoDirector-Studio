import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const port = Number(process.env.SMOKE_PORT ?? 8791)
const baseUrl = `http://127.0.0.1:${port}`
const stateDir = mkdtempSync(join(tmpdir(), "autodirector-smoke-offline-"))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitForServer() {
  const started = Date.now()
  while (Date.now() - started < 15_000) {
    try {
      const response = await fetch(`${baseUrl}/api/bootstrap`)
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error("server did not become ready")
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  const type = response.headers.get("content-type") ?? ""
  return type.includes("application/json") ? response.json() : response.text()
}

async function requestRaw(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options)
}

function assertZipClean() {
  const result = spawnSync(process.execPath, ["scripts/package-code.mjs"], { cwd: root, encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "package-code failed")
  const zipinfo = spawnSync("zipinfo", ["-1", "autodirector-code.zip"], { cwd: root, encoding: "utf8" })
  if (zipinfo.status !== 0) throw new Error(zipinfo.stderr || zipinfo.stdout || "zipinfo failed")
  const forbidden = /(^|\/)(node_modules|\.git|dist|\.tmp|\.autodirector|\.agents|output|intro-site\/assets|intro-site\/control-ui\/assets|intro-site\/hero-video\/assets|intro-site\/hero-video\/audio)(\/|$)|\.(mp4|mov|mp3|wav|aiff|ogg|m4a|png|jpg|jpeg|webp|zip|log|pyc|pyo)$|(^|\/)\.env($|\.local$|\.development$|\.production$|\.test$)/i
  for (const entry of zipinfo.stdout.split(/\r?\n/).filter(Boolean)) {
    assert(!forbidden.test(entry), `source ZIP contains forbidden entry ${entry}`)
  }
}

async function main() {
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      AUTODIRECTOR_STATE_DIR: stateDir,
      AUTODIRECTOR_PUBLIC_ORIGIN: baseUrl,
    },
    stdio: ["ignore", "ignore", "pipe"],
  })

  let stderr = ""
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString()
  })

  try {
    await waitForServer()
    const home = await request("/")
    assert(home.includes("AutoDirector"), "local home page missing AutoDirector")

    const bootstrap = await request("/api/bootstrap")
    assert(Array.isArray(bootstrap.workers) && bootstrap.workers.length >= 6, "bootstrap missing Agent workers")
    assert(Array.isArray(bootstrap.pipeline) && bootstrap.pipeline.length >= 6, "bootstrap missing pipeline")
    assert(bootstrap.settings, "bootstrap missing settings")

    await request("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentHost: "codex_native",
        modelProvider: "deepseek_api",
        visualProvider: "public_source_only",
        defaultRuntime: "hyperframes",
        layoutMode: "simple",
        executionMode: "legacy_template",
      }),
    })

    const afterOnboarding = await request("/api/bootstrap")
    assert(afterOnboarding.settings?.completed, "offline onboarding did not persist")
    assert(afterOnboarding.settings?.modelProvider === "deepseek_api", "offline onboarding did not persist model provider")
    assert(afterOnboarding.settings?.visualProvider === "public_source_only", "offline visual provider was not saved")
    assert(afterOnboarding.capabilities?.modelProviders?.some((provider) => provider.id === "qwen_api"), "bootstrap missing Qwen provider option")
    assert(afterOnboarding.capabilities?.modelProviders?.some((provider) => provider.id === "openai_compatible"), "bootstrap missing custom endpoint provider option")

    const created = await request("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief: "Offline asset boundary smoke", autoStart: false }),
    })
    const runId = created.activeRun?.id
    assert(runId, "offline run was not created")

    const outsideAssetDir = mkdtempSync(join(tmpdir(), "autodirector-outside-assets-"))
    try {
      const rejected = await requestRaw(`/api/runs/${runId}/register-image-assets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetDir: outsideAssetDir }),
      })
      assert(rejected.status === 400, `outside asset dir should be rejected, got ${rejected.status}`)
    } finally {
      rmSync(outsideAssetDir, { recursive: true, force: true })
    }

    const allowedAssetDir = join(root, "output", "imagegen", runId)
    mkdirSync(allowedAssetDir, { recursive: true })
    try {
      const accepted = await requestRaw(`/api/runs/${runId}/register-image-assets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetDir: allowedAssetDir }),
      })
      assert(accepted.ok, `allowed asset dir should be accepted, got ${accepted.status}`)
    } finally {
      rmSync(allowedAssetDir, { recursive: true, force: true })
    }

    assertZipClean()
    console.log("Offline smoke passed: local server, bootstrap, onboarding, and source ZIP checks.")
  } finally {
    server.kill()
    rmSync(stateDir, { recursive: true, force: true })
    if (process.exitCode && stderr) console.error(stderr)
  }
}

main().catch((error) => {
  console.error(`Offline smoke failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
