import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createHash, randomBytes } from "node:crypto"

const root = fileURLToPath(new URL("..", import.meta.url))
const port = Number(process.env.SMOKE_PORT ?? 8790)
const baseUrl = `http://127.0.0.1:${port}`
const stateDir = mkdtempSync(join(tmpdir(), "autodirector-smoke-"))
const createdOutputDirs = []
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAwUBAWjz5xUAAAAASUVORK5CYII=", "base64")

function fail(message) {
  console.error(`Smoke failed: ${message}`)
  process.exitCode = 1
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

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

async function patch(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

async function postWithAuth(path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

async function getRun(runId) {
  const response = await fetch(`${baseUrl}/api/runs/${runId}`)
  if (!response.ok) throw new Error(`/api/runs/${runId} returned ${response.status}`)
  return response.json()
}

function writeSmokeImageAssets(runId, count = 8) {
  const assetDir = join(root, "output", "imagegen", runId)
  mkdirSync(assetDir, { recursive: true })
  createdOutputDirs.push(assetDir)
  for (let index = 1; index <= count; index += 1) {
    writeFileSync(join(assetDir, `scene-${index}.png`), tinyPng)
  }
  return assetDir
}

async function submitExpectedArtifact(run, expected) {
  const task = run.tasks.find((item) => item.status === "working")
  if (!task) throw new Error(`full-chain smoke missing working task before ${expected.stepId}`)
  if (task.stepId !== expected.stepId || task.agentId !== expected.agentId || task.outputId !== expected.outputId) {
    throw new Error(`full-chain smoke expected ${expected.stepId}/${expected.agentId}/${expected.outputId}, got ${task.stepId}/${task.agentId}/${task.outputId}`)
  }
  const result = await post(`/api/runs/${run.id}/agent-artifact`, {
    taskId: task.id,
    agentId: task.agentId,
    artifact: {
      title: `${task.label} smoke artifact`,
      type: expected.type ?? "json",
      summary: `${task.agentId} submitted ${task.outputId} through the real artifact endpoint.`,
      content: {
        status: "passed",
        outputId: task.outputId,
        stage: task.stepId,
        upstreamArtifactIds: task.inputArtifactIds,
        smoke: "full artifact chain",
      },
      checks: ["schema valid", "handoff recorded", "stage accepted"],
    },
  })
  return result.activeRun
}

async function assertFullArtifactChainPackage() {
  const created = await post("/api/generate-one-click", {
    brief: "Smoke test: smart water bottle full artifact chain",
  })
  let run = created.activeRun
  if (!run?.id) throw new Error("full-chain smoke run was not created")
  if (run.package) throw new Error("full-chain smoke should not create a package before artifacts")

  const assetDir = writeSmokeImageAssets(run.id)
  const registered = await post(`/api/runs/${run.id}/register-image-assets`, { assetDir })
  run = registered.activeRun
  if (!run.imageAssetDir?.endsWith(`/output/imagegen/${run.id}`)) throw new Error("full-chain smoke image assets were not registered")

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
    run = await submitExpectedArtifact(run, expected)
  }

  const finalRun = await getRun(run.id)
  if (!["ready_to_package", "final"].includes(finalRun.status)) throw new Error(`full-chain smoke final status should be complete, got ${finalRun.status}`)
  if (finalRun.completedSteps !== chain.length) throw new Error(`full-chain smoke completed ${finalRun.completedSteps}/${chain.length} steps`)
  if (finalRun.package?.status !== "ready") throw new Error(`full-chain smoke package should be ready, got ${finalRun.package?.status}`)
  if (!finalRun.package.finalVideoUrl?.endsWith("/final.mp4")) throw new Error("full-chain smoke package missing final.mp4 URL")
  for (const required of ["judging_readme.md", "source_project.zip", "asset_manifest.json", "citations.md", "quality_report.md", "run_log.jsonl"]) {
    if (!finalRun.package.files?.includes(required)) throw new Error(`full-chain smoke package missing ${required}`)
  }
  for (const required of ["recorder_log.jsonl", "recorder_summary.md", "skill_suggestions.json"]) {
    if (!finalRun.package.files?.includes(required)) throw new Error(`full-chain smoke recorder package missing ${required}`)
  }
  if (!finalRun.package.files?.some((file) => file.startsWith("generated_skills/") && file.endsWith("SKILL.md"))) {
    throw new Error("full-chain smoke package missing generated Recorder skills")
  }
  return finalRun
}

function sha256Base64Url(value) {
  return createHash("sha256").update(value).digest("base64url")
}

async function runOAuthFlow() {
  const protectedResource = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`)
  if (!protectedResource.ok) throw new Error("protected resource metadata failed")
  const protectedMetadata = await protectedResource.json()
  if (!protectedMetadata.authorization_servers?.includes(baseUrl)) throw new Error("authorization server missing from protected metadata")

  const authMetadataResponse = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)
  if (!authMetadataResponse.ok) throw new Error("authorization server metadata failed")
  const authMetadata = await authMetadataResponse.json()
  if (!authMetadata.code_challenge_methods_supported?.includes("S256")) throw new Error("PKCE S256 missing")
  if (!authMetadata.registration_endpoint) throw new Error("DCR endpoint missing")

  const registerResponse = await fetch(authMetadata.registration_endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "AutoDirector Smoke Client",
      redirect_uris: [`${baseUrl}/oauth/smoke-callback`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid profile autodirector.run",
    }),
  })
  if (!registerResponse.ok) throw new Error("DCR failed")
  const client = await registerResponse.json()

  const verifier = randomBytes(32).toString("base64url")
  const state = randomBytes(16).toString("base64url")
  const authorizeUrl = new URL(authMetadata.authorization_endpoint)
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("client_id", client.client_id)
  authorizeUrl.searchParams.set("redirect_uri", `${baseUrl}/oauth/smoke-callback`)
  authorizeUrl.searchParams.set("scope", "openid profile autodirector.run")
  authorizeUrl.searchParams.set("state", state)
  authorizeUrl.searchParams.set("resource", baseUrl)
  authorizeUrl.searchParams.set("code_challenge_method", "S256")
  authorizeUrl.searchParams.set("code_challenge", sha256Base64Url(verifier))
  authorizeUrl.searchParams.set("autodirector_auto_approve", "1")
  const authorizeResponse = await fetch(authorizeUrl, { redirect: "manual" })
  if (authorizeResponse.status !== 302) throw new Error(`authorize returned ${authorizeResponse.status}`)
  const redirect = new URL(authorizeResponse.headers.get("location"))
  if (redirect.searchParams.get("state") !== state) throw new Error("OAuth state mismatch")
  const code = redirect.searchParams.get("code")
  if (!code) throw new Error("missing authorization code")

  const tokenResponse = await fetch(authMetadata.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: client.client_id,
      redirect_uri: `${baseUrl}/oauth/smoke-callback`,
      code_verifier: verifier,
    }),
  })
  if (!tokenResponse.ok) throw new Error(`token endpoint returned ${tokenResponse.status}`)
  const token = await tokenResponse.json()
  if (!token.access_token || token.token_type !== "Bearer") throw new Error("invalid token response")

  const jwksResponse = await fetch(authMetadata.jwks_uri)
  if (!jwksResponse.ok) throw new Error("JWKS failed")
  const jwks = await jwksResponse.json()
  if (!jwks.keys?.length) throw new Error("JWKS empty")
  return token.access_token
}

async function assertApiBrowserBoundary() {
  const textPlain = await fetch(`${baseUrl}/api/onboarding`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ agentHost: "codex_native" }),
  })
  if (textPlain.status !== 415) throw new Error(`text/plain API mutation should be rejected, got ${textPlain.status}`)

  const crossOrigin = await fetch(`${baseUrl}/api/onboarding`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    body: JSON.stringify({ agentHost: "codex_native" }),
  })
  if (crossOrigin.status !== 403) throw new Error(`cross-origin API mutation should be rejected, got ${crossOrigin.status}`)
}

async function waitForNativeCapabilities() {
  const started = Date.now()
  let last = null
  while (Date.now() - started < 10_000) {
    const response = await fetch(`${baseUrl}/api/bootstrap`)
    if (!response.ok) throw new Error("bootstrap failed while checking native capabilities")
    const payload = await response.json()
    last = payload.capabilities?.codexNative
    if (
      payload.settings?.executionMode === "codex_native" &&
      payload.settings?.agentHost === "codex_native" &&
      last?.available &&
      last?.appServer &&
      last?.loggedInWithChatGPT &&
      last?.imageGeneration &&
      last?.toolSearch
    ) {
      return payload
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`native capabilities not ready: ${JSON.stringify(last)}`)
}

async function assertOpenAiAccountOAuthStart() {
  const response = await fetch(`${baseUrl}/oauth/start`, { redirect: "manual" })
  if (response.status !== 302) throw new Error(`/oauth/start returned ${response.status}`)
  const location = response.headers.get("location")
  if (!location) throw new Error("/oauth/start missing redirect location")
  const redirect = new URL(location)
  if (redirect.origin !== "https://auth.openai.com") throw new Error(`/oauth/start did not redirect to OpenAI: ${location}`)
  if (redirect.pathname !== "/oauth/authorize") throw new Error("OpenAI authorize path mismatch")
  if (redirect.searchParams.get("client_id") !== "app_EMoamEEZ73f0CkXaXp7hrann") throw new Error("OpenAI Codex client_id missing")
  if (redirect.searchParams.get("redirect_uri") !== "http://localhost:1455/auth/callback") throw new Error("OpenAI Codex redirect_uri mismatch")
  if (redirect.searchParams.get("scope") !== "openid profile email offline_access") throw new Error("OpenAI scopes mismatch")
  if (redirect.searchParams.get("code_challenge_method") !== "S256") throw new Error("OpenAI PKCE S256 missing")
  if (redirect.searchParams.get("codex_cli_simplified_flow") !== "true") throw new Error("Codex simplified flow missing")
  if (!redirect.searchParams.get("code_challenge") || !redirect.searchParams.get("state")) throw new Error("OpenAI OAuth state/challenge missing")
}

async function main() {
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), AUTODIRECTOR_STATE_DIR: stateDir, AUTODIRECTOR_ALLOW_OAUTH_AUTO_APPROVE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let stderr = ""
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString()
  })

  try {
    await waitForServer()
    await waitForNativeCapabilities()
    await assertApiBrowserBoundary()
    await assertOpenAiAccountOAuthStart()
    const accessToken = await runOAuthFlow()
    const unauthTools = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    if (unauthTools.status !== 401) throw new Error("MCP tools/list should require OAuth")

    await post("/api/onboarding", {
      defaultRuntime: "hyperframes",
      layoutMode: "simple",
      executionMode: "oauth_agents",
      agentHost: "codex_plugin",
      modelProvider: "openai_compatible",
    })

    const oneClick = await post("/api/generate-one-click", {
      brief: "Smoke test: real OAuth Agent kernel",
    })
    const run = oneClick.activeRun
    if (run?.package) throw new Error("oauth_agents mode should not create a fake final package")
    if (run.status !== "active") throw new Error(`run not active: ${run.status}`)
    if (run.automationStatus !== "waiting_agent") throw new Error(`run not waiting for agent: ${run.automationStatus}`)
    if (run.completedSteps !== 0) throw new Error("pipeline should wait for first real artifact")
    const workingTask = run.tasks.find((task) => task.status === "working")
    if (workingTask?.agentId !== "producer" || workingTask?.outputId !== "task_graph") throw new Error("first real task was not assigned to Producer")

    const badSubmit = await fetch(`${baseUrl}/api/runs/${run.id}/agent-artifact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: "task_not_the_working_task",
        agentId: "producer",
        artifact: {
          title: "Bad task id",
          type: "../../escape",
          summary: "This should not advance the run.",
          content: { shouldNotWrite: true },
          checks: ["invalid task id rejected"],
        },
      }),
    })
    if (badSubmit.status !== 400) throw new Error(`invalid task submission should return 400, got ${badSubmit.status}`)
    const afterBadSubmit = await fetch(`${baseUrl}/api/runs/${run.id}`).then((response) => response.json())
    if (afterBadSubmit.completedSteps !== 0) throw new Error("invalid task submission advanced the pipeline")
    if (!afterBadSubmit.tasks.some((task) => task.id === "task_brief" && task.status === "working")) throw new Error("invalid task submission changed the working task")

    const submit = await post(`/api/runs/${run.id}/agent-artifact`, {
      taskId: "task_brief",
      agentId: "producer",
      artifact: {
        title: "Smoke task graph",
        type: "json",
        summary: "Producer submitted a real task_graph through the artifact endpoint.",
        content: { mode: "oauth_agents", next: "research" },
        checks: ["submitted through real agent endpoint"],
      },
    })
    const afterSubmit = submit.activeRun
    if (afterSubmit.completedSteps !== 1) throw new Error("submitted artifact did not advance pipeline")
    const nextWorking = afterSubmit.tasks.find((task) => task.status === "working")
    if (nextWorking?.agentId !== "research") throw new Error("Producer did not hand off to Research after artifact submit")
    if (!afterSubmit.artifacts.some((artifact) => artifact.id === "task_graph" && artifact.path.includes("agent-artifacts"))) throw new Error("submitted artifact was not recorded")

    const tools = await postWithAuth("/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" }, accessToken)
    const toolNames = tools.result.tools.map((tool) => tool.name)
    if (!toolNames.includes("autodirector_generate_one_click")) throw new Error("MCP one-click tool missing")
    if (!toolNames.includes("autodirector_get_agent_task")) throw new Error("MCP get-agent-task tool missing")
    if (!toolNames.includes("autodirector_submit_agent_artifact")) throw new Error("MCP submit-agent-artifact tool missing")
    if (!toolNames.includes("autodirector_get_recorder_memory")) throw new Error("MCP recorder memory tool missing")

    const mcpRun = await postWithAuth(
      "/mcp",
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "autodirector_create_run", arguments: { brief: "OAuth smoke MCP run" } } },
      accessToken
    )
    if (!mcpRun.result?.content?.[0]?.text?.includes("Run created")) throw new Error("authenticated MCP tool call failed")

    const chainRun = await assertFullArtifactChainPackage()

    await patch("/api/settings", { executionMode: "legacy_template" })
    const blockedPackage = await post("/api/generate-one-click", {
      brief: "Smoke test: package must not pass without OAuth imagegen hero assets",
    })
    const blockedRun = blockedPackage.activeRun
    if (blockedRun?.package?.status !== "blocked") throw new Error("package should be blocked when OAuth imagegen assets are missing")
    if (blockedRun.package.finalVideoUrl) throw new Error("blocked package should not expose a fake final.mp4")
    if (!blockedRun.package.blockedReason?.some((reason) => reason.includes("OAuth imagegen"))) throw new Error("blocked package did not explain missing OAuth imagegen assets")

    console.log(`Smoke passed: ${run.id}`)
    console.log(`Full artifact-chain smoke passed: ${chainRun.id}`)
    console.log("Real OAuth Agent kernel waits for artifact submission before advancing.")
    console.log("Quality gate blocks fake final.mp4 when OAuth imagegen assets are missing.")
  } finally {
    server.kill()
    for (const dir of createdOutputDirs) rmSync(dir, { recursive: true, force: true })
    rmSync(stateDir, { recursive: true, force: true })
    if (process.exitCode && stderr) console.error(stderr)
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
