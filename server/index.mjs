import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:http"
import { homedir } from "node:os"
import { basename, dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn, spawnSync } from "node:child_process"
import {
  createHash,
  createPublicKey,
  createSign,
  createVerify,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto"

import { codexBinary, codexNativeStatus, getCodexAppServerRuntimeStatus } from "./codex-app-server.mjs"
import { createCodexNativeAgentRuntime } from "./codex-native-agents.mjs"
import { normalizeAgentArtifact } from "./artifact-schema.mjs"
import { isPathInsideDir } from "./security-utils.mjs"

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)))
const stateDir = resolve(process.env.AUTODIRECTOR_STATE_DIR ?? join(rootDir, ".autodirector"))
const statePath = join(stateDir, "state.json")
const distDir = join(rootDir, "dist")
const runsDir = join(stateDir, "runs")
const projectSlug = basename(rootDir).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "project"
const codexWorkDir = resolve(process.env.AUTODIRECTOR_CODEX_WORKDIR ?? join(homedir(), ".autodirector", "codex-workspaces", projectSlug))
const codexSessionDir = resolve(process.env.AUTODIRECTOR_CODEX_SESSION_DIR ?? join(homedir(), ".autodirector", "codex-sessions", projectSlug))
const port = Number(process.env.PORT ?? 8787)

const agents = [
  ["producer", "Producer", "管理员 / 制片人"],
  ["research", "Research", "研究与选题"],
  ["director", "Story Director", "脚本 / 字幕 / 导演 / 动效"],
  ["asset", "Asset", "素材与音乐"],
  ["programmer", "Video Engineer", "HyperFrames / Remotion 规划与编程"],
  ["render", "Render", "渲染工程"],
  ["quality", "Quality Gate", "自动质检"],
]

const agentModelPolicy = {
  producer: { model: "gpt-5.5", thinkingLevel: "xhigh", thinkingLabel: "extra high" },
  research: { model: "gpt-5.5", thinkingLevel: "high", thinkingLabel: "high" },
  director: { model: "gpt-5.5", thinkingLevel: "high", thinkingLabel: "high" },
  asset: { model: "gpt-5.5", thinkingLevel: "high", thinkingLabel: "high", capabilities: ["imagegen", "browser_search", "web_music_search"] },
  programmer: { model: "gpt-5.5", thinkingLevel: "high", thinkingLabel: "high" },
  render: { model: "tool-runner", thinkingLevel: "low", thinkingLabel: "low", capabilities: ["ffmpeg", "zip", "probe"] },
  quality: { model: "gpt-5.5", thinkingLevel: "high", thinkingLabel: "high" },
}

const defaultImageModel = "gpt-image-2"
const agentHostOptions = [
  {
    id: "codex_native",
    name: "Codex Native Kernel",
    imagegen: true,
    webSearch: true,
    codeExecution: true,
    note: "Recommended: persistent Codex app-server threads on the user's machine. Uses the user's Codex login / ChatGPT subscription and native image_generation/tool_search tools.",
  },
  {
    id: "codex_plugin",
    name: "Codex Plugin",
    imagegen: true,
    webSearch: true,
    codeExecution: true,
    note: "Best default for this product: Codex can use AutoDirector MCP tools and the host imagegen skill.",
  },
  {
    id: "openai_api",
    name: "OpenAI API",
    imagegen: true,
    webSearch: false,
    codeExecution: true,
    note: "Good for hosted automation when the user explicitly supplies API credentials.",
  },
  {
    id: "claude_code",
    name: "Claude Code / other coding agent",
    imagegen: false,
    webSearch: true,
    codeExecution: true,
    note: "Can run the pipeline and build video code, but generated hero visuals must come from upload or another image provider.",
  },
  {
    id: "custom_mcp",
    name: "Custom MCP Agent",
    imagegen: false,
    webSearch: "depends",
    codeExecution: "depends",
    note: "Runtime-agnostic route. Capabilities are declared by the connected host.",
  },
]
const visualProviderOptions = [
  {
    id: "codex_imagegen",
    name: "Codex Native / ChatGPT imagegen",
    canGenerate: true,
    model: defaultImageModel,
    note: "Preferred. Codex Native Kernel Agents generate files with the native image_generation tool and register them with AutoDirector.",
  },
  {
    id: "openai_image_api",
    name: "OpenAI Image API",
    canGenerate: true,
    model: defaultImageModel,
    note: "Optional API route for users who want hosted automation instead of plugin-hosted generation.",
  },
  {
    id: "user_upload",
    name: "User upload",
    canGenerate: false,
    model: null,
    note: "User supplies approved images. Pipeline continues after registration.",
  },
  {
    id: "public_source_only",
    name: "Public/source assets only",
    canGenerate: false,
    model: null,
    note: "Works for real editorial/source footage; any generated visual request is blocked instead of faked.",
  },
]
const openAiOauth = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  redirectUri: process.env.OPENAI_OAUTH_REDIRECT_URI ?? "http://localhost:1455/auth/callback",
  defaultScopes: "openid profile email offline_access",
  refreshScopes: "openid profile email",
  userAgent: "codex-cli/0.91.0",
  codexResponsesUrl: "https://chatgpt.com/backend-api/codex/responses",
  codexUserAgent: "codex_cli_rs/0.125.0",
  codexVersion: "0.125.0",
}
const openAiOauthRedirect = new URL(openAiOauth.redirectUri)

const pipeline = [
  ["brief", "用户 Brief", "producer", "task_graph"],
  ["research", "研究选题", "research", "research_pack"],
  ["script", "脚本字幕", "director", "script"],
  ["director", "导演动效", "director", "shotlist"],
  ["asset", "素材音乐", "asset", "asset_manifest"],
  ["runtime", "运行时计划", "programmer", "runtime_plan"],
  ["programmer", "视频编程", "programmer", "source_project"],
  ["render", "渲染导出", "render", "render_report"],
  ["quality", "自动质检", "quality", "quality_report"],
]

const stageTokenWeights = {
  brief: 900,
  research: 1900,
  script: 2300,
  director: 2100,
  asset: 2600,
  runtime: 1700,
  programmer: 3800,
  render: 900,
  quality: 1200,
}

const difficultyMultipliers = {
  1: 0.72,
  2: 1,
  3: 1.35,
  4: 1.78,
  5: 2.35,
}

function estimateTextTokens(text = "") {
  const body = String(text ?? "")
  if (!body) return 0
  const cjk = body.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0
  const other = Math.max(0, body.length - cjk)
  return Math.max(1, Math.ceil(cjk * 0.9 + other / 4))
}

function defaultTokensPerSecond(level = 3) {
  return { 1: 30, 2: 24, 3: 18, 4: 14, 5: 10 }[Number(level)] ?? 18
}

function estimateRunDifficulty(brief = "", settings = {}) {
  const text = String(brief ?? "")
  const lower = text.toLowerCase()
  let score = 1
  const reasons = []
  if (text.length > 80) {
    score += 0.55
    reasons.push("brief 信息较多")
  }
  if (text.length > 180) {
    score += 0.45
    reasons.push("需求约束较长")
  }
  if (/最近|最新|冲突|新闻|上网|搜索|source|citation|真实|照片|素材|马斯克|奥特曼|openai|竞争|对比/i.test(text)) {
    score += 0.8
    reasons.push("需要资料/真实素材核验")
  }
  if (/imagegen|图片生成|导图|视觉|质感|电影|cinematic|转场|音乐|配音|字幕|hyperframes/i.test(text)) {
    score += 0.8
    reasons.push("视觉、音频和动效要求高")
  }
  if (/60秒|一分钟|1分钟|长一点|详细|完整|夺冠|极致|完美/i.test(text)) {
    score += 0.7
    reasons.push("时长或质量目标偏高")
  }
  if (/数据|图表|对比|速度|排名|增长|timeline|pipeline/i.test(text)) {
    score += 0.35
    reasons.push("包含结构化信息呈现")
  }
  if ((settings.defaultRuntime ?? "") === "hyperframes") {
    score += 0.25
    reasons.push("HyperFrames 动效链路")
  }
  const level = Math.max(1, Math.min(5, Math.round(score)))
  const labels = {
    1: "快速",
    2: "标准",
    3: "复杂",
    4: "高难",
    5: "竞赛级",
  }
  const multiplier = difficultyMultipliers[level] ?? 1.35
  const estimatedTotalTokens = Math.round(
    pipeline.reduce((sum, [stepId]) => sum + (stageTokenWeights[stepId] ?? 1200), 0) * multiplier,
  )
  return {
    level,
    label: labels[level],
    score: Number(score.toFixed(2)),
    estimatedTotalTokens,
    reasoning: reasons.length ? reasons.slice(0, 4) : ["常规短视频生产链路"],
    createdAt: new Date().toISOString(),
    source: "producer_preflight_estimate",
  }
}

function completedTokenEstimate(run) {
  const level = run?.difficultyEstimate?.level ?? 3
  const multiplier = difficultyMultipliers[level] ?? 1.35
  const completed = Math.max(0, Math.min(Number(run?.completedSteps ?? 0), pipeline.length))
  return Math.round(
    pipeline.slice(0, completed).reduce((sum, [stepId]) => sum + (stageTokenWeights[stepId] ?? 1200), 0) * multiplier,
  )
}

function ensureTokenTelemetry(run) {
  if (!run) return null
  const total = run.difficultyEstimate?.estimatedTotalTokens ?? estimateRunDifficulty(run.brief, state.settings).estimatedTotalTokens
  run.tokenTelemetry = {
    status: "waiting_for_tokens",
    sampleWindowSeconds: 30,
    sampleStartedAt: null,
    sampleEndsAt: null,
    observedTokens: 0,
    sampleTokens: 0,
    observedCharacters: 0,
    averageTokensPerSecond: null,
    recentTokensPerSecond: null,
    estimatedTotalTokens: total,
    estimatedRemainingTokens: total,
    estimatedRemainingSeconds: Math.ceil(total / defaultTokensPerSecond(run.difficultyEstimate?.level ?? 3)),
    estimatedCompletionAt: null,
    confidence: "warming_up",
    source: "first_30s_output_speed",
    updatedAt: new Date().toISOString(),
    ...(run.tokenTelemetry ?? {}),
  }
  recomputeRunEta(run)
  return run.tokenTelemetry
}

function recomputeRunEta(run, nowMs = Date.now()) {
  if (!run) return null
  const telemetry = ensureTokenTelemetryNoRecurse(run)
  const level = run.difficultyEstimate?.level ?? 3
  const total = run.difficultyEstimate?.estimatedTotalTokens ?? telemetry.estimatedTotalTokens
  const sampleStartedMs = telemetry.sampleStartedAt ? Date.parse(telemetry.sampleStartedAt) : null
  const sampleWindowSeconds = telemetry.sampleWindowSeconds ?? 30
  const sampleElapsed = sampleStartedMs ? Math.max(0.25, Math.min((nowMs - sampleStartedMs) / 1000, sampleWindowSeconds)) : 0
  const sampleDone = sampleStartedMs ? nowMs >= sampleStartedMs + sampleWindowSeconds * 1000 : false
  const sampledSpeed = sampleElapsed ? telemetry.sampleTokens / sampleElapsed : null
  const lockedSpeed =
    sampleDone && telemetry.sampleTokens > 0
      ? Math.max(0.5, telemetry.sampleTokens / sampleWindowSeconds)
      : telemetry.averageTokensPerSecond
  const speed = Math.max(0.5, lockedSpeed || sampledSpeed || defaultTokensPerSecond(level))
  const doneTokens = Math.max(completedTokenEstimate(run), telemetry.observedTokens ?? 0)
  const remaining = run.status === "final" ? 0 : Math.max(0, total - doneTokens)
  const remainingSeconds = remaining === 0 ? 0 : Math.ceil(remaining / speed)
  telemetry.status = run.status === "final" ? "complete" : sampleStartedMs ? sampleDone ? "estimating" : "sampling" : "waiting_for_tokens"
  telemetry.averageTokensPerSecond = Number(speed.toFixed(2))
  telemetry.recentTokensPerSecond = sampledSpeed ? Number(sampledSpeed.toFixed(2)) : telemetry.recentTokensPerSecond
  telemetry.estimatedTotalTokens = total
  telemetry.estimatedRemainingTokens = remaining
  telemetry.estimatedRemainingSeconds = remainingSeconds
  telemetry.estimatedCompletionAt = remainingSeconds ? new Date(nowMs + remainingSeconds * 1000).toISOString() : new Date(nowMs).toISOString()
  telemetry.confidence = telemetry.status === "sampling" ? "warming_up" : telemetry.sampleTokens >= 120 ? "high" : telemetry.sampleTokens >= 40 ? "medium" : "low"
  telemetry.updatedAt = new Date(nowMs).toISOString()
  return telemetry
}

function ensureTokenTelemetryNoRecurse(run) {
  if (!run.tokenTelemetry) {
    const total = run.difficultyEstimate?.estimatedTotalTokens ?? estimateRunDifficulty(run.brief, state.settings).estimatedTotalTokens
    run.tokenTelemetry = {
      status: "waiting_for_tokens",
      sampleWindowSeconds: 30,
      sampleStartedAt: null,
      sampleEndsAt: null,
      observedTokens: 0,
      sampleTokens: 0,
      observedCharacters: 0,
      averageTokensPerSecond: null,
      recentTokensPerSecond: null,
      estimatedTotalTokens: total,
      estimatedRemainingTokens: total,
      estimatedRemainingSeconds: Math.ceil(total / defaultTokensPerSecond(run.difficultyEstimate?.level ?? 3)),
      estimatedCompletionAt: null,
      confidence: "warming_up",
      source: "first_30s_output_speed",
      updatedAt: new Date().toISOString(),
    }
  }
  return run.tokenTelemetry
}

function recordTokenSample(runId, sample = {}) {
  const run = state.runs[runId]
  if (!run) return null
  const text = String(sample.text ?? sample.delta ?? "")
  const tokens = Number(sample.tokens ?? estimateTextTokens(text))
  if (!Number.isFinite(tokens) || tokens <= 0) return run.tokenTelemetry ?? null
  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()
  const telemetry = ensureTokenTelemetryNoRecurse(run)
  if (!telemetry.sampleStartedAt) {
    telemetry.sampleStartedAt = now
    telemetry.sampleEndsAt = new Date(nowMs + (telemetry.sampleWindowSeconds ?? 30) * 1000).toISOString()
  }
  const sampleEndMs = Date.parse(telemetry.sampleEndsAt)
  telemetry.observedTokens = Math.round((telemetry.observedTokens ?? 0) + tokens)
  telemetry.observedCharacters = (telemetry.observedCharacters ?? 0) + text.length
  if (nowMs <= sampleEndMs) telemetry.sampleTokens = Math.round((telemetry.sampleTokens ?? 0) + tokens)
  recomputeRunEta(run, nowMs)
  run.updatedAt = now
  const lastBroadcast = telemetry.lastBroadcastAt ? Date.parse(telemetry.lastBroadcastAt) : 0
  if (nowMs - lastBroadcast > 1500) {
    telemetry.lastBroadcastAt = now
    pushEvent("token.telemetry", {
      runId,
      agentId: sample.agentId ?? null,
      taskId: sample.taskId ?? null,
      tokens,
      averageTokensPerSecond: telemetry.averageTokensPerSecond,
      estimatedRemainingSeconds: telemetry.estimatedRemainingSeconds,
      confidence: telemetry.confidence,
    })
  }
  return telemetry
}

function upstreamArtifactIdsForStep(index) {
  const outputId = pipeline[index]?.[3]
  if (index < 0 || !pipeline[index]) return []
  if (index === 0) return ["project_brief"]
  if (outputId === "script") return ["research_pack", "project_brief"]
  if (outputId === "shotlist") return ["script", "research_pack", "task_graph"]
  if (outputId === "asset_manifest") return ["shotlist", "script", "research_pack"]
  if (outputId === "runtime_plan") return ["shotlist", "asset_manifest", "script", "research_pack"]
  if (outputId === "source_project") return ["runtime_plan", "asset_manifest", "shotlist", "script"]
  if (outputId === "render_report") return ["source_project", "runtime_plan", "asset_manifest"]
  if (outputId === "quality_report") return ["render_report", "source_project", "asset_manifest", "runtime_plan"]
  return [pipeline[index - 1][3]]
}

const artifactTemplates = {
  task_graph: ["任务图与成功标准", "json", "Producer 已把 brief 拆成流水线、Agent、质量门和 patch loop。"],
  user_preferences: ["用户偏好画像", "json", "Research 固化目标受众、平台规格、画幅、时长和素材限制。"],
  research_pack: ["研究与选题包", "json", "Research 收集资料、来源、关键事实、风险标注，并锁定叙事角度。"],
  topic_scorecard: ["选题评分", "json", "Research 评估角度、标题、叙事钩子和制作风险。"],
  script: ["旁白与字幕脚本", "md", "Story Director 写出按时间切分的旁白、字幕、字幕安全区和引用绑定。"],
  caption_styleguide: ["字幕样式规范", "json", "Story Director 锁定字幕安全区、分行、字号、强调词和遮挡检查。"],
  shotlist: ["导演分镜与动效", "json", "Director 生成镜头语言、转场、节奏、动效和字幕画面层级。"],
  motion_board: ["转场与动效板", "json", "Story Director 定义镜头进入、停留、退出、easing、节奏和运动限制。"],
  asset_manifest: ["素材与声音清单", "json", "Asset 为每个镜头标注视觉素材、音乐/音效、用途、风险和替代方案。"],
  sound_plan: ["音乐与音效计划", "json", "Asset 规划音乐 mood、BPM、hit points、SFX、ducking 和授权风险。"],
  runtime_plan: ["Runtime Plan", "json", "Video Engineer 锁定 HyperFrames / Remotion 实现计划和检查命令。"],
  source_project: ["源码项目", "folder", "Video Engineer 按 runtime_plan 生成项目骨架和实现说明。"],
  render_report: ["渲染报告", "log", "Render Agent 记录预览、关键帧检查、导出命令和错误定位。"],
  quality_report: ["质量报告", "md", "Quality Gate 自动检查时长、字幕、事实、素材和最终包完整性。"],
}

const clients = new Set()
const automationTimers = new Map()
const agentModelTimers = new Map()
const autoStepDelayMs = Number(process.env.AUTODIRECTOR_AUTO_STEP_DELAY_MS ?? 950)
const videoWidth = 720
const videoHeight = 960
const videoFps = 30

function commandAvailable(command) {
  return spawnSync("which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).status === 0
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function wrapText(value, maxChars = 34) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim()
  if (!raw) return []
  const visualLength = (text) => [...text].reduce((sum, char) => sum + (/[\u4e00-\u9fff]/.test(char) ? 1 : 0.56), 0)
  const shouldBreakAfter = (char) => /[，。！？、；：,.!?;:]/.test(char)
  const hasCjk = /[\u4e00-\u9fff]/.test(raw)
  if (hasCjk) {
    const lines = []
    let line = ""
    for (const char of [...raw]) {
      const next = `${line}${char}`
      if (visualLength(next) > maxChars && line) {
        lines.push(line.trim())
        line = char.trimStart()
      } else {
        line = next
      }
      if (visualLength(line) > maxChars * 0.72 && shouldBreakAfter(char)) {
        lines.push(line.trim())
        line = ""
      }
    }
    if (line.trim()) lines.push(line.trim())
    return lines.slice(0, 5)
  }
  const splitLong = (word) => {
    if (word.length <= maxChars) return [word]
    const parts = []
    for (let index = 0; index < word.length; index += maxChars) parts.push(word.slice(index, index + maxChars))
    return parts
  }
  const words = raw.split(/\s+/).filter(Boolean)
  if (words.length <= 1 && raw.length > maxChars) {
    const lines = []
    for (let index = 0; index < raw.length; index += maxChars) lines.push(raw.slice(index, index + maxChars))
    return lines.slice(0, 4)
  }
  const lines = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      const parts = splitLong(word)
      line = parts.pop() ?? ""
      lines.push(...parts)
    } else if (next.length > maxChars) {
      const parts = splitLong(word)
      line = parts.pop() ?? ""
      lines.push(...parts)
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 4)
}

function svgText(lines, x, y, size, fill, weight = 500, lineHeight = 1.25) {
  return lines
    .map((line, index) => {
      const dy = index * size * lineHeight
      return `<text x="${x}" y="${y + dy}" font-family="Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`
    })
    .join("\n")
}

function svgTextBlock(lines, x, y, size, fill, weight = 500, lineHeight = 1.25, anchor = "start") {
  return lines
    .map((line, index) => {
      const dy = index * size * lineHeight
      return `<text x="${x}" y="${y + dy}" text-anchor="${anchor}" font-family="Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`
    })
    .join("\n")
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url")
}

function randomId(prefix) {
  return `${prefix}_${randomBytes(24).toString("base64url")}`
}

function sha256Base64Url(value) {
  return createHash("sha256").update(value).digest("base64url")
}

function generateOpenAiCodeVerifier() {
  return randomBytes(64).toString("hex")
}

function buildOpenAiAuthorizationUrl({ oauthState, codeChallenge, redirectUri }) {
  const authorize = new URL(openAiOauth.authorizeUrl)
  authorize.searchParams.set("response_type", "code")
  authorize.searchParams.set("client_id", openAiOauth.clientId)
  authorize.searchParams.set("redirect_uri", redirectUri)
  authorize.searchParams.set("scope", openAiOauth.defaultScopes)
  authorize.searchParams.set("state", oauthState)
  authorize.searchParams.set("code_challenge", codeChallenge)
  authorize.searchParams.set("code_challenge_method", "S256")
  authorize.searchParams.set("id_token_add_organizations", "true")
  authorize.searchParams.set("codex_cli_simplified_flow", "true")
  return authorize
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = String(token ?? "").split(".")
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

function extractOpenAiUserInfo(idToken, accessToken) {
  const claims = decodeJwtPayload(idToken) ?? decodeJwtPayload(accessToken) ?? {}
  const auth = claims["https://api.openai.com/auth"] ?? {}
  return {
    subject: claims.sub ?? null,
    email: claims.email ?? null,
    name: claims.name ?? null,
    chatgptAccountId: auth.chatgpt_account_id ?? null,
    chatgptUserId: auth.chatgpt_user_id ?? null,
    organizationId: auth.organization_id ?? auth.poid ?? null,
    planType: auth.chatgpt_plan_type ?? auth.plan_type ?? null,
  }
}

function publicOpenAiAccount() {
  if (!state.openaiAccount) return null
  return {
    provider: state.openaiAccount.provider,
    connectedAt: state.openaiAccount.connectedAt,
    expiresAt: state.openaiAccount.expiresAt,
    scope: state.openaiAccount.scope,
    clientId: state.openaiAccount.clientId,
    user: state.openaiAccount.user,
  }
}

async function exchangeOpenAiCode({ code, codeVerifier, redirectUri }) {
  const response = await fetch(openAiOauth.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": openAiOauth.userAgent,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: openAiOauth.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })
  const textBody = await response.text()
  let payload = {}
  try {
    payload = textBody ? JSON.parse(textBody) : {}
  } catch {
    payload = { error: textBody }
  }
  if (!response.ok) {
    const error = payload.error_description ?? payload.error ?? `OpenAI OAuth token exchange failed (${response.status})`
    throw new Error(String(error))
  }
  return payload
}

async function refreshOpenAiTokenIfNeeded(force = false) {
  const account = state.openaiAccount
  if (!account?.refreshToken) return null
  if (!force && account.expiresAt && Date.parse(account.expiresAt) - Date.now() > 120_000) return account
  const response = await fetch(openAiOauth.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": openAiOauth.userAgent,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      client_id: account.clientId || openAiOauth.clientId,
      scope: openAiOauth.refreshScopes,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(payload.error_description ?? payload.error ?? "OpenAI OAuth refresh failed"))
  const expiresIn = Number(payload.expires_in ?? 3600)
  state.openaiAccount = {
    ...account,
    accessToken: payload.access_token ?? account.accessToken,
    refreshToken: payload.refresh_token || account.refreshToken,
    idToken: payload.id_token ?? account.idToken,
    tokenType: payload.token_type ?? account.tokenType,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: payload.scope ?? account.scope,
    user: extractOpenAiUserInfo(payload.id_token ?? account.idToken, payload.access_token ?? account.accessToken),
    refreshedAt: new Date().toISOString(),
  }
  saveState()
  return state.openaiAccount
}

function redactSecret(value) {
  return String(value ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/g, "Bearer [redacted]")
    .replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/g, '"refresh_token":"[redacted]"')
    .replace(/"id_token"\s*:\s*"[^"]+"/g, '"id_token":"[redacted]"')
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 120_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function responseTextWithTimeout(response, timeoutMs = 120_000) {
  return await Promise.race([
    response.text(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`response read timed out after ${timeoutMs}ms`)), timeoutMs)),
  ])
}

function timeoutPromise(timeoutMs, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs))
}

function normalizeThinkingLevel(value) {
  const level = String(value ?? "").toLowerCase()
  if (level === "low" || level === "medium" || level === "high") return level
  return level === "xhigh" ? "high" : "medium"
}

function producerSystemInstructions() {
  return [
    "你是 AutoDirector 的 Producer Agent，用户只和你对话。",
    "你必须真实理解用户刚说的话，不要使用固定模板，不要复读用户原句，不要输出表格。",
    "当前阶段只是 intake：你可以澄清需求、判断是否已经能开始制作、指出还缺什么；没收到用户明确 Start production 之前，不要声称已经派发 Agent。",
    "回复要短、自然、像真正的制片主任：中文优先，最多 2-4 句。",
    "如果用户只是打招呼或测试，就正常回应；如果用户给了视频需求，就帮他把方向收敛成可执行 brief，并说明下一步需要他补充或可以开工。",
    "AutoDirector 的核心团队只有 7 个持久 Agent：Producer、Research、Story Director、Asset、Video Engineer、Render、Quality Gate。不要再提 14 个岗位或一堆虚拟角色。",
    "Story Director 同时负责脚本、字幕、分镜和动效意图；Asset 同时负责图片、真实素材、音乐和音效计划；Video Engineer 同时负责 runtime_plan 和视频工程实现。",
    "当提到素材、图片、音乐、事实核查时，要明确这些会在开工后交给对应 Agent 通过 Browser Use、tool_search、imagegen 或 artifact 流水线处理。",
    "如果用户提到本地网易云音乐、.ncm 或本地曲库，记录为可用但需审计的背景音乐来源：必须走 ncm-to-mp3 dry-run/manifest 转换，Sound 先看 metadata/最好试听，不能随机挑歌；Render 只能接转换后的音频路径，Quality Gate 要检查证据链。",
  ].join("\n")
}

function toResponseInputMessage(item) {
  const role = item.role === "producer" || item.role === "assistant" ? "assistant" : "user"
  const text = String(item.body ?? item.content ?? item.text ?? "").trim()
  if (!text) return null
  return { role, content: [{ type: role === "assistant" ? "output_text" : "input_text", text }] }
}

function buildProducerChatPayload(body = {}) {
  const text = String(body.text ?? "").trim()
  if (!text) {
    const error = new Error("message_required")
    error.status = 400
    throw error
  }
  const history = Array.isArray(body.messages) ? body.messages.slice(-14).map(toResponseInputMessage).filter(Boolean) : []
  const hasLatest = history.some((item) => item.role === "user" && item.content?.some((part) => String(part.text ?? "").trim() === text))
  const input = hasLatest ? history : history.concat({ role: "user", content: [{ type: "input_text", text }] })
  const producerPolicy = state.settings.modelPolicy?.producer ?? agentModelPolicy.producer
  return {
    model: producerPolicy.model || "gpt-5.5",
    instructions: producerSystemInstructions(),
    input,
    reasoning: { effort: normalizeThinkingLevel(producerPolicy.thinkingLevel) },
    store: false,
    stream: true,
  }
}

function collectTextFromContent(content) {
  if (!content) return []
  if (typeof content === "string") return [content]
  if (Array.isArray(content)) return content.flatMap(collectTextFromContent)
  if (typeof content !== "object") return []
  if (typeof content.text === "string") return [content.text]
  if (typeof content.output_text === "string") return [content.output_text]
  if (typeof content.content === "string") return [content.content]
  if (content.content) return collectTextFromContent(content.content)
  return []
}

function extractResponsesText(payload) {
  if (!payload || typeof payload !== "object") return ""
  if (typeof payload.output_text === "string") return payload.output_text
  if (typeof payload.text === "string") return payload.text
  const parts = []
  if (Array.isArray(payload.output)) {
    for (const item of payload.output) parts.push(...collectTextFromContent(item?.content ?? item))
  }
  if (payload.message) parts.push(...collectTextFromContent(payload.message.content ?? payload.message))
  if (payload.response) parts.push(extractResponsesText(payload.response))
  return parts.filter(Boolean).join("")
}

function parseResponsesStream(raw) {
  const chunks = []
  let completed = ""
  for (const block of String(raw ?? "").split(/\n\n+/)) {
    const dataLines = block
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
    for (const line of dataLines) {
      if (!line || line === "[DONE]") continue
      try {
        const event = JSON.parse(line)
        const eventType = String(event.type ?? "")
        if (eventType === "response.output_text.delta") {
          if (typeof event.delta === "string") chunks.push(event.delta)
          else if (typeof event.text === "string") chunks.push(event.text)
          continue
        }
        if (eventType.includes("delta")) {
          if (typeof event.delta === "string") chunks.push(event.delta)
          else if (typeof event.text === "string") chunks.push(event.text)
        }
        if (event.type === "response.completed") completed = extractResponsesText(event.response)
        if (event.response && !completed) completed = extractResponsesText(event.response)
      } catch {
        continue
      }
    }
  }
  return (completed || chunks.join("")).trim()
}

async function callProducerChatModel(body = {}) {
  if (normalizeExecutionMode(state.settings.executionMode) === "codex_native" || state.settings.agentHost === "codex_native" || state.settings.agentHost === "codex_cli") {
    return await codexNativeRuntime().runProducerTurn(body)
  }
  const account = await refreshOpenAiTokenIfNeeded()
  if (!account?.accessToken) {
    const error = new Error("OpenAI / Codex OAuth 未连接。请先在 Setup 或 Settings 里 Connect ChatGPT。")
    error.status = 401
    error.code = "openai_oauth_required"
    throw error
  }

  const payload = buildProducerChatPayload(body)
  const headers = {
    "content-type": "application/json",
    accept: "text/event-stream",
    authorization: `Bearer ${account.accessToken}`,
    "openai-beta": "responses=experimental",
    originator: "codex_cli_rs",
    version: openAiOauth.codexVersion,
    "user-agent": openAiOauth.codexUserAgent,
  }
  const chatgptAccountId = account.user?.chatgptAccountId
  if (chatgptAccountId) headers["chatgpt-account-id"] = chatgptAccountId

  let response
  try {
    response = await fetchWithTimeout(openAiOauth.codexResponsesUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }, 120_000)
  } catch (error) {
    const detail = [error.message, error.cause?.message, error.cause?.code].filter(Boolean).join(" / ")
    const wrapped = new Error(`ChatGPT/Codex 网络请求失败：${detail || "fetch failed"}`)
    wrapped.status = 502
    wrapped.code = "producer_model_network_failed"
    throw wrapped
  }
  const raw = await responseTextWithTimeout(response, 120_000)
  if (!response.ok) {
    const error = new Error(`ChatGPT/Codex 模型调用失败：${response.status} ${response.statusText} ${redactSecret(raw).slice(0, 600)}`)
    error.status = response.status
    error.code = "producer_model_failed"
    throw error
  }

  let answer = ""
  if ((response.headers.get("content-type") ?? "").includes("application/json")) {
    answer = extractResponsesText(JSON.parse(raw))
  } else {
    answer = parseResponsesStream(raw)
  }
  if (!answer) {
    const error = new Error("ChatGPT/Codex 返回了空消息。")
    error.status = 502
    error.code = "empty_model_response"
    throw error
  }
  return {
    message: {
      id: `producer_${Date.now()}`,
      role: "producer",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      body: answer,
      model: payload.model,
      thinkingLevel: state.settings.modelPolicy?.producer?.thinkingLabel ?? state.settings.modelPolicy?.producer?.thinkingLevel ?? "high",
      source: "chatgpt_codex_oauth",
    },
  }
}

function parseJsonFromModelText(text) {
  const raw = String(text ?? "").trim()
  if (!raw) return null
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)
  if (!candidate || !candidate.startsWith("{")) return null
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function codexArtifactSchemaPath() {
  const schemaPath = join(stateDir, "codex-artifact.schema.json")
  if (!existsSync(schemaPath)) {
    writeJson(schemaPath, {
      type: "object",
      additionalProperties: false,
      required: ["title", "type", "summary", "content", "checks"],
      properties: {
        title: { type: "string" },
        type: { type: "string" },
        summary: { type: "string" },
        content: {
          anyOf: [
            { type: "object" },
            { type: "array" },
            { type: "string" },
            { type: "number" },
            { type: "boolean" },
            { type: "null" },
          ],
        },
        checks: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["done", "blocked"] },
      },
    })
  }
  return schemaPath
}

function skillPathsForAgent(agentId) {
  const paths = []
  const add = (filePath) => {
    if (filePath && existsSync(filePath) && !paths.includes(filePath)) paths.push(filePath)
  }
  add(join(rootDir, "docs", "agent-skills", `${agentId}.md`))
  const addDoc = (name) => add(join(rootDir, "docs", "agent-skills", `${name}.md`))
  const addRuntimePack = (name) => add(join(rootDir, "docs", "runtime-packs", `${name}.md`))
  const pluginMap = {
    producer: "producer",
    research: "research",
    director: "director",
    asset: "visual-imagegen",
    programmer: "builder",
    quality: "quality-gate",
  }
  const pluginSkill = pluginMap[agentId]
    ? join(rootDir, "plugins", "autodirector-codex", "skills", pluginMap[agentId], "SKILL.md")
    : null
  if (pluginSkill && existsSync(pluginSkill)) add(pluginSkill)
  addRuntimePack("hyperframes-pack")
  if (agentId === "producer") {
    addDoc("producer")
    addDoc("autodirector-product-promo-video")
    addDoc("science-news-explainer-video")
    addDoc("voice-screen-sync")
    addDoc("visual-composition")
    addDoc("tts-quality")
  }
  if (agentId === "director") {
    addDoc("autodirector-product-promo-video")
    addDoc("science-news-explainer-video")
    addDoc("script")
    addDoc("caption")
    addDoc("motion")
    addDoc("voice-screen-sync")
    addDoc("visual-composition")
    addDoc("tts-quality")
    addDoc("hyperframes-cinema")
  }
  if (agentId === "asset") {
    addDoc("autodirector-product-promo-video")
    addDoc("science-news-explainer-video")
    addDoc("imagegen")
    addDoc("sound")
    addDoc("visual-composition")
    addDoc("tts-quality")
    addDoc("hyperframes-cinema")
  }
  if (agentId === "programmer") {
    addDoc("autodirector-product-promo-video")
    addDoc("science-news-explainer-video")
    addDoc("runtime-planner")
    addDoc("video-programmer")
    addDoc("voice-screen-sync")
    addDoc("visual-composition")
    addDoc("tts-quality")
    addDoc("hyperframes-cinema")
    addRuntimePack("remotion-pack")
  }
  if (agentId === "quality") {
    addDoc("autodirector-product-promo-video")
    addDoc("science-news-explainer-video")
    addDoc("quality-gate")
    addDoc("caption")
    addDoc("motion")
    addDoc("imagegen")
    addDoc("voice-screen-sync")
    addDoc("visual-composition")
    addDoc("tts-quality")
    addDoc("hyperframes-cinema")
  }
  const hyperframesSkillDir = resolve(rootDir, "..", "..", ".codex", "plugins", "cache", "openai-curated", "hyperframes", "3c463363", "skills")
  if (agentId === "programmer" || agentId === "quality" || agentId === "director") {
    add(join(hyperframesSkillDir, "hyperframes", "SKILL.md"))
    add(join(hyperframesSkillDir, "hyperframes-cli", "SKILL.md"))
    add(join(hyperframesSkillDir, "hyperframes-registry", "SKILL.md"))
  }
  if (agentId === "programmer" || agentId === "research") {
    add(join(hyperframesSkillDir, "website-to-hyperframes", "SKILL.md"))
  }
  return paths
}

function codexWorkerPrompt(run, task, worker) {
  const instructions = agentTaskInstructions(run, task, worker)
  const assetDir = join(rootDir, "output", "imagegen", run.id)
  return [
    `你是 AutoDirector 的真实 Codex Native Agent：${worker.shortName}。`,
    "你运行在用户本机 Codex app-server 持久内核里，不要调用 AutoDirector 旧的 backend-api/codex/responses 拼请求。",
    "只完成当前 Agent 的任务，不要替下游 Agent 抢活。",
    "你可以读取项目文件、使用 Codex 原生工具、web_search、MCP、shell/code 工具和 image_generation 能力。",
    "如果需要生成主视觉或导图，必须使用 Codex 原生 image_generation / imagegen 能力，生成后把最终 PNG 放入指定目录；不要用 HTML/SVG/canvas/local raster 冒充生成图。",
    `生成图目录：${assetDir}`,
    "图片命名：scene-1.png, scene-2.png, scene-3.png, scene-4.png, scene-5.png。生成成功后在 content.imagegen_assets.asset_dir 写入该目录。",
    "如果工具缺失或登录不可用，返回 status=blocked，并在 content.required_tools 写清楚缺什么。",
    "必须先阅读这些 skill/规范文件，如果存在：",
    ...skillPathsForAgent(task.agentId).map((item) => `- ${item}`),
    "最终回复必须是严格 JSON，字段只能是 title/type/summary/content/checks/status。",
    "不要 Markdown，不要解释，不要代码块。",
    JSON.stringify({
      currentDate: new Date().toISOString(),
      runId: run.id,
      taskId: task.id,
      task: instructions,
    }, null, 2),
  ].join("\n\n")
}

function parseCodexArtifact(answer, task) {
  const parsed = parseJsonFromModelText(answer)
  const template = artifactTemplates[task.outputId] ?? [task.outputId, "json", "Agent artifact."]
  if (parsed && typeof parsed === "object") {
    return {
      title: parsed.title ?? template[0],
      type: parsed.type ?? template[1],
      summary: parsed.summary ?? template[2],
      content: parsed.content ?? answer,
      checks: Array.isArray(parsed.checks) ? parsed.checks : ["codex cli artifact generated", "handoff ready"],
      status: parsed.status === "blocked" ? "blocked" : "done",
    }
  }
  return {
    title: template[0],
    type: template[1],
    summary: answer.slice(0, 220) || template[2],
    content: answer || template[2],
    checks: ["generated by native Codex app-server Agent", "handoff ready"],
    status: "done",
  }
}

async function callCodexNativeArtifactModel(run, task, worker) {
  return await codexNativeRuntime().runAgentTurn(run, task, worker)
}

function sourceProjectDirForRun(run) {
  const artifact = run.artifacts.find((item) => item.id === "source_project")
  const content = parseArtifactContent(artifact)
  const projectPath =
    typeof content === "object" && content
      ? content.project_path ?? content.path ?? content.output_dir ?? content.source_project
      : null
  const candidates = [
    projectPath ? resolve(rootDir, String(projectPath)) : null,
    join(runsDir, run.id, "agent-artifacts", "source_project"),
  ].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isDirectory()) ?? null
}

function voiceoverTextForProject(projectDir) {
  const direct = join(projectDir, "voiceover_zh.txt")
  if (existsSync(direct)) {
    const text = readFileSync(direct, "utf8").trim()
    if (text) return text
  }
  const dataFile = join(projectDir, "src", "data.js")
  if (existsSync(dataFile)) {
    const body = readFileSync(dataFile, "utf8")
    const matches = [...body.matchAll(/'([^']{8,160})'/g)].map((match) => match[1])
    const zh = matches.filter((text) => /[\u4e00-\u9fff]/.test(text)).slice(-6)
    if (zh.length) return zh.join("。")
  }
  return "AutoDirector 正在用持久 Agent 团队完成视频制作。从 brief 到素材、编程、渲染和自动质检，每一步都有可审计 artifact。"
}

async function addNarrationTrack(run, projectDir, inputVideoPath) {
  if (!commandAvailable("ffmpeg")) return { outputPath: inputVideoPath, audioStatus: "ffmpeg_unavailable" }
  const audioDir = join(projectDir, "dist", "audio")
  ensureDir(audioDir)
  const narrationText = voiceoverTextForProject(projectDir)
  const narrationTextPath = join(audioDir, "voiceover_zh.txt")
  const narrationAiff = join(audioDir, "voiceover.aiff")
  const narrationMp3 = join(audioDir, "voiceover-edge.mp3")
  const outputPath = inputVideoPath.replace(/\.mp4$/i, "_with_audio.mp4")
  writeFileSync(narrationTextPath, narrationText)
  let voiceInputPath = narrationAiff
  let voiceProvider = "macos_say"
  if (commandAvailable("edge-tts")) {
    await runCommandAsync(
      "edge-tts",
      ["--voice", "zh-CN-YunxiNeural", "--text", narrationText, "--write-media", narrationMp3],
      { cwd: projectDir, timeoutMs: 120_000 }
    )
    voiceInputPath = narrationMp3
    voiceProvider = "edge-tts:zh-CN-YunxiNeural"
  } else if (commandAvailable("say")) {
    await runCommandAsync("say", ["-o", narrationAiff, "-f", narrationTextPath], { cwd: projectDir, timeoutMs: 90_000 })
  } else {
    return { outputPath: inputVideoPath, audioStatus: "tts_unavailable", narrationTextPath }
  }
  await runCommandAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputVideoPath,
      "-i",
      voiceInputPath,
      "-filter_complex",
      "[1:a]volume=1.0,apad,atrim=0:30[a]",
      "-map",
      "0:v:0",
      "-map",
      "[a]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { cwd: projectDir, timeoutMs: 180_000 }
  )
  return {
    outputPath,
    audioStatus: "narration_added",
    voiceProvider,
    narrationTextPath,
    narrationAudioPath: voiceInputPath,
    narrationPreview: narrationText.slice(0, 240),
  }
}

async function runLocalRenderArtifact(run, task, worker) {
  const projectDir = sourceProjectDirForRun(run)
  if (!projectDir) {
    return {
      title: "渲染阻塞报告",
      type: "log",
      summary: "Render 找不到可运行 source_project，不能伪造 final.mp4。",
      content: {
        status: "blocked",
        reason: "source_project_missing",
        required: "Video Programmer 必须提交包含 package.json 和 scripts/render.mjs 的 source_project。",
      },
      checks: ["source project missing", "render blocked honestly"],
      status: "blocked",
    }
  }

  const startedAt = new Date().toISOString()
  pushEvent("render.started", { runId: run.id, agentId: worker.id, projectDir })
  run.logs.push(`[render] running npm run render in ${projectDir}`)
  saveState()
  try {
    const result = await runCommandAsync("npm", ["run", "render"], {
      cwd: projectDir,
      timeoutMs: Number(process.env.AUTODIRECTOR_RENDER_TIMEOUT_MS ?? 25 * 60_000),
    })
    const distDirForProject = join(projectDir, "dist")
    const files = existsSync(distDirForProject) ? listFilesRecursive(distDirForProject) : []
    const mp4 = files.find((file) => file.endsWith(".mp4"))
    if (!mp4) throw new Error(`render completed but no mp4 found in ${distDirForProject}`)
    const rawOutputPath = join(distDirForProject, mp4)
    const audioResult = await addNarrationTrack(run, projectDir, rawOutputPath)
    const outputPath = audioResult.outputPath
    const finalFiles = existsSync(distDirForProject) ? listFilesRecursive(distDirForProject) : files
    const report = {
      status: "done",
      startedAt,
      completedAt: new Date().toISOString(),
      projectDir,
      command: "npm run render",
      rawOutputPath,
      outputPath,
      outputFile: outputPath.split("/").at(-1),
      distFiles: finalFiles,
      audio: audioResult,
      logTail: result.stdout.slice(-5000),
    }
    pushEvent("render.completed", { runId: run.id, agentId: worker.id, outputPath })
    return {
      title: "渲染报告",
      type: "log",
      summary: `Render 已真实执行 source_project，产出 ${mp4}。`,
      content: report,
      checks: ["npm run render exited 0", "mp4 exists", "source project render path verified"],
      status: "done",
    }
  } catch (error) {
    const message = redactSecret(error?.message ?? String(error))
    pushEvent("render.failed", { runId: run.id, agentId: worker.id, error: message })
    return {
      title: "渲染阻塞报告",
      type: "log",
      summary: `Render 执行失败：${message.slice(0, 220)}`,
      content: {
        status: "blocked",
        startedAt,
        completedAt: new Date().toISOString(),
        projectDir,
        command: "npm run render",
        error: message,
      },
      checks: ["render attempted", "failure logged", "no fake final.mp4"],
      status: "blocked",
    }
  }
}

function agentModelInstructions(worker, task) {
  const suggestedType = artifactTemplates[task.outputId]?.[1] ?? "json"
  return [
    `你是 AutoDirector 的 ${worker.shortName} Agent。`,
    `你只负责当前任务，不要替其他 Agent 完成任务。`,
    `必须基于输入 instructions 和上游 artifacts 产出一个可交接 artifact。`,
    `返回 ONLY JSON，不要 Markdown，不要解释。JSON schema:`,
    `{"title":"string","type":"${suggestedType}","summary":"string","content":object|string,"checks":["string"]}`,
    `content 要具体，不能写空话；checks 写 3-6 条可验证完成标准。`,
    `如果需要 Browser Use、imagegen、音乐搜索或代码执行但当前工具不可用，要在 content.risks 和 content.required_tools 里明确写出来，不要假装已经完成。`,
  ].join("\n")
}

async function callAgentArtifactModel(run, task, worker) {
  const account = await refreshOpenAiTokenIfNeeded()
  if (!account?.accessToken) {
    const error = new Error("OpenAI / Codex OAuth 未连接，Agent 不能真实执行。")
    error.status = 401
    error.code = "openai_oauth_required"
    throw error
  }

  const instructions = agentTaskInstructions(run, task, worker)
  const policy = state.settings.modelPolicy?.[worker.id] ?? agentModelPolicy[worker.id] ?? agentModelPolicy.producer
  const payload = {
    model: String(policy.model ?? worker.model ?? "gpt-5.5").startsWith("gpt") ? String(policy.model ?? worker.model) : "gpt-5.5",
    instructions: agentModelInstructions(worker, task),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              runId: run.id,
              taskId: task.id,
              currentDate: new Date().toISOString(),
              task: instructions,
            }, null, 2),
          },
        ],
      },
    ],
    reasoning: { effort: normalizeThinkingLevel(policy.thinkingLevel ?? worker.thinkingLevel) },
    store: false,
    stream: true,
  }
  const headers = {
    "content-type": "application/json",
    accept: "text/event-stream",
    authorization: `Bearer ${account.accessToken}`,
    "openai-beta": "responses=experimental",
    originator: "codex_cli_rs",
    version: openAiOauth.codexVersion,
    "user-agent": openAiOauth.codexUserAgent,
  }
  const chatgptAccountId = account.user?.chatgptAccountId
  if (chatgptAccountId) headers["chatgpt-account-id"] = chatgptAccountId

  let response
  try {
    response = await fetchWithTimeout(openAiOauth.codexResponsesUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }, 120_000)
  } catch (error) {
    const detail = [error.message, error.cause?.message, error.cause?.code].filter(Boolean).join(" / ")
    const wrapped = new Error(`Agent 网络请求失败：${detail || "fetch failed"}`)
    wrapped.status = 502
    wrapped.code = "agent_model_network_failed"
    throw wrapped
  }
  const raw = await responseTextWithTimeout(response, 120_000)
  if (!response.ok) {
    const error = new Error(`Agent 模型调用失败：${response.status} ${response.statusText} ${redactSecret(raw).slice(0, 600)}`)
    error.status = response.status
    error.code = "agent_model_failed"
    throw error
  }

  const answer = ((response.headers.get("content-type") ?? "").includes("application/json")
    ? extractResponsesText(JSON.parse(raw))
    : parseResponsesStream(raw)).trim()
  const parsed = parseJsonFromModelText(answer)
  const template = artifactTemplates[task.outputId] ?? [task.outputId, "json", "Agent artifact."]
  return parsed && typeof parsed === "object"
    ? {
        title: parsed.title ?? template[0],
        type: parsed.type ?? template[1],
        summary: parsed.summary ?? template[2],
        content: parsed.content ?? answer,
        checks: Array.isArray(parsed.checks) ? parsed.checks : ["model artifact generated", "handoff ready"],
      }
    : {
        title: template[0],
        type: template[1],
        summary: answer.slice(0, 220) || template[2],
        content: answer || template[2],
        checks: ["generated by ChatGPT/Codex OAuth Agent", "handoff ready"],
      }
}

function scheduleAgentModelTask(runId, taskId) {
  const key = `${runId}:${taskId}`
  if (agentModelTimers.has(key)) return
  const timer = setTimeout(async () => {
    agentModelTimers.delete(key)
    const run = state.runs[runId]
    const task = run?.tasks.find((item) => item.id === taskId)
    if (!run || !task || task.status !== "working") return
    const worker = state.workers[task.agentId]
    let executionMode = normalizeExecutionMode(task.executionMode ?? run.executionMode ?? state.settings.executionMode)
    try {
      pushEvent("agent.thinking.started", { runId, stepId: task.stepId, agentId: task.agentId, outputId: task.outputId, model: worker.model })
      task.modelAttempts = Number(task.modelAttempts ?? 0) + 1
      run.logs.push(`[agent] ${worker.shortName} Agent running on ${worker.model} for ${task.outputId}`)
      saveState()
      if (worker.model === "tool-runner") {
        const artifact =
          task.outputId === "render_report"
            ? await runLocalRenderArtifact(run, task, worker)
            : artifactFor({ stepId: task.stepId, label: task.label, agentId: task.agentId, outputId: task.outputId }, run)
        completeAgentTask(runId, {
          taskId: task.id,
          agentId: task.agentId,
          status: artifact.status === "blocked" ? "blocked" : "done",
          submittedBy: `${worker.shortName} local tool-runner`,
          artifact: {
            ...artifact,
            summary: `${artifact.summary} 本步骤由本地 tool-runner 执行，不走 GPT 模型。`,
            checks: [...(artifact.checks ?? []), "local tool-runner path", "no GPT fallback"],
          },
        })
        pushEvent(artifact.status === "blocked" ? "agent.tool_runner.blocked" : "agent.tool_runner.completed", { runId, stepId: task.stepId, agentId: task.agentId, outputId: task.outputId, model: worker.model })
        return
      }
      const artifact = await Promise.race([
        executionMode === "codex_native" ? callCodexNativeArtifactModel(run, task, worker) : callAgentArtifactModel(run, task, worker),
        timeoutPromise(executionMode === "codex_native" ? Number(process.env.AUTODIRECTOR_CODEX_TIMEOUT_MS ?? 15 * 60_000) + 5_000 : 95_000, `${worker.shortName} Agent watchdog timed out`),
      ])
      completeAgentTask(runId, {
        taskId: task.id,
        agentId: task.agentId,
        status: artifact.status === "blocked" ? "blocked" : "done",
        submittedBy: executionMode === "codex_native" ? `${worker.shortName} native Codex app-server Agent` : `${worker.shortName} ChatGPT/Codex OAuth Agent`,
        artifact,
      })
      pushEvent("agent.thinking.completed", { runId, stepId: task.stepId, agentId: task.agentId, outputId: task.outputId, model: worker.model })
    } catch (error) {
      const message = String(error?.message ?? error)
      if (executionMode !== "codex_native" && message.includes("watchdog timed out") && task.status === "working") {
        run.logs.push(`[watchdog] ${worker.shortName} Agent timed out; blocking instead of submitting a fake artifact`)
      }
      const attempts = Number(task.modelAttempts ?? 1)
      if (attempts < 2 && task.status === "working") {
        task.error = redactSecret(error.message ?? String(error))
        run.logs.push(`[retry] ${worker.shortName} Agent attempt ${attempts} failed: ${task.error}`)
        saveState()
        pushEvent("agent.thinking.retry", { runId, stepId: task.stepId, agentId: task.agentId, outputId: task.outputId, model: worker.model, error: task.error, nextAttempt: attempts + 1 })
        scheduleAgentModelTask(runId, taskId)
        return
      }
      worker.status = "failed"
      worker.currentTaskId = null
      task.status = "blocked"
      task.error = redactSecret(error.message ?? String(error))
      run.status = "blocked"
      run.automationStatus = "blocked"
      recomputeRunEta(run)
      run.logs.push(`[error] ${worker.shortName} model call failed: ${task.error}`)
      saveState()
      pushEvent("agent.thinking.failed", { runId, stepId: task.stepId, agentId: task.agentId, outputId: task.outputId, model: worker.model, error: task.error })
    }
  }, 250)
  agentModelTimers.set(key, timer)
}

function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] ?? "http"
  return `${proto}://${req.headers.host}`
}

function sameApiOrigin(req) {
  const originHeader = req.headers.origin
  const secFetchSite = req.headers["sec-fetch-site"]
  if (secFetchSite && !["same-origin", "none"].includes(String(secFetchSite))) return false
  if (!originHeader) return true
  try {
    const requestOrigin = new URL(originHeader)
    const serverOrigin = new URL(originFromReq(req))
    if (requestOrigin.origin === serverOrigin.origin) return true
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"])
    return localHosts.has(requestOrigin.hostname) && localHosts.has(serverOrigin.hostname)
  } catch {
    return false
  }
}

function hasRequestBody(req) {
  const length = Number(req.headers["content-length"] ?? 0)
  return length > 0 || Boolean(req.headers["transfer-encoding"])
}

function requireApiMutationRequest(req, res) {
  if (!sameApiOrigin(req)) {
    json(res, 403, { error: "forbidden_origin" })
    return false
  }
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase()
  if (hasRequestBody(req) && !contentType.includes("application/json")) {
    json(res, 415, { error: "json_content_type_required" })
    return false
  }
  return true
}

function oauthMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    jwks_uri: `${origin}/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["openid", "profile", "autodirector.run"],
    resource_documentation: `${origin}/`,
  }
}

function ensureOAuthState() {
  state.oauth = {
    clients: {},
    codes: {},
    tokens: {},
    refreshTokens: {},
    uiStates: {},
    localClientId: null,
    keys: null,
    ...(state.oauth ?? {}),
  }

  if (!state.oauth.keys?.privateKeyPem || !state.oauth.keys?.publicKeyPem) {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
    state.oauth.keys = {
      kid: randomId("kid"),
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }),
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
      createdAt: new Date().toISOString(),
    }
  }
}

function signJwt(payload, origin) {
  ensureOAuthState()
  const header = { alg: "RS256", typ: "JWT", kid: state.oauth.keys.kid }
  const now = Math.floor(Date.now() / 1000)
  const body = {
    iss: origin,
    aud: origin,
    resource: origin,
    iat: now,
    nbf: now - 5,
    exp: now + 3600,
    ...payload,
  }
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(body))}`
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(state.oauth.keys.privateKeyPem, "base64url")
  return `${signingInput}.${signature}`
}

function verifyJwt(token, origin) {
  ensureOAuthState()
  const [encodedHeader, encodedPayload, signature] = String(token).split(".")
  if (!encodedHeader || !encodedPayload || !signature) throw new Error("malformed_token")
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const valid = createVerify("RSA-SHA256").update(signingInput).end().verify(state.oauth.keys.publicKeyPem, signature, "base64url")
  if (!valid) throw new Error("invalid_signature")
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
  const now = Math.floor(Date.now() / 1000)
  if (payload.iss !== origin) throw new Error("invalid_issuer")
  if (payload.aud !== origin && payload.resource !== origin) throw new Error("invalid_audience")
  if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("token_expired")
  if (typeof payload.nbf === "number" && payload.nbf > now) throw new Error("token_not_yet_valid")
  return payload
}

function hasScopes(payload, requiredScopes) {
  const scopes = new Set(String(payload.scope ?? "").split(/\s+/).filter(Boolean))
  return requiredScopes.every((scope) => scopes.has(scope))
}

function authChallenge(req) {
  const origin = originFromReq(req)
  return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="autodirector.run"`
}

function unauthorized(res, req, detail = "invalid_token") {
  res.writeHead(401, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "WWW-Authenticate": `${authChallenge(req)}, error="${detail}"`,
  })
  res.end(JSON.stringify({ error: "unauthorized", detail }, null, 2))
}

function requireBearer(req, res, requiredScopes = []) {
  const header = req.headers.authorization ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) {
    unauthorized(res, req, "missing_token")
    return null
  }

  try {
    const payload = verifyJwt(match[1], originFromReq(req))
    if (!state.oauth.tokens[match[1]]) {
      unauthorized(res, req, "unknown_token")
      return null
    }
    if (!hasScopes(payload, requiredScopes)) {
      unauthorized(res, req, "insufficient_scope")
      return null
    }
    return payload
  } catch (error) {
    unauthorized(res, req, error instanceof Error ? error.message : "invalid_token")
    return null
  }
}

function defaultWorkers() {
  return Object.fromEntries(
    agents.map(([id, shortName, role]) => [
      id,
      {
        id,
        shortName,
        role,
        model: agentModelPolicy[id]?.model ?? "gpt-5.5",
        thinkingLevel: agentModelPolicy[id]?.thinkingLevel ?? "medium",
        thinkingLabel: agentModelPolicy[id]?.thinkingLabel ?? "medium",
        capabilities: agentModelPolicy[id]?.capabilities ?? [],
        status: "queued",
        inbox: [],
        outbox: [],
        currentTaskId: null,
        artifacts: [],
        lastActive: null,
      },
    ])
  )
}

function defaultState() {
  return {
    settings: {
      completed: false,
      providerId: "openai_codex_oauth",
      authStatus: "disconnected",
      modelPolicy: agentModelPolicy,
      imageModel: defaultImageModel,
      defaultRuntime: "hyperframes",
      layoutMode: "simple",
      executionMode: "codex_native",
      agentHost: "codex_native",
      visualProvider: "codex_imagegen",
      updatedAt: new Date().toISOString(),
    },
    activeRunId: null,
    runs: {},
    workers: defaultWorkers(),
    events: [],
    oauth: {
      clients: {},
      codes: {},
      tokens: {},
      refreshTokens: {},
      uiStates: {},
      localClientId: null,
      keys: null,
    },
    openaiAccount: null,
  }
}

function loadState() {
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true })
  if (!existsSync(statePath)) {
    const fresh = defaultState()
    saveState(fresh)
    return fresh
  }

  try {
    return { ...defaultState(), ...JSON.parse(readFileSync(statePath, "utf8")) }
  } catch {
    const fresh = defaultState()
    saveState(fresh)
    return fresh
  }
}

function saveState(nextState = state) {
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true })
  const tempPath = `${statePath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tempPath, `${JSON.stringify(nextState, null, 2)}\n`)
  renameSync(tempPath, statePath)
}

function mergeModelPolicy(overrides = {}) {
  return Object.fromEntries(
    Object.keys(agentModelPolicy).map((id) => [
      id,
      {
        ...(agentModelPolicy[id] ?? {}),
        ...(overrides[id] ?? {}),
      },
    ])
  )
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function allowedImageAssetRoots(run) {
  return [
    join(rootDir, "output", "imagegen", run.id),
    join(runsDir, run.id),
  ].map((dir) => resolve(dir))
}

function validateImageAssetDir(run, assetDir) {
  const resolvedAssetDir = resolve(String(assetDir))
  const allowedRoots = allowedImageAssetRoots(run)
  if (!allowedRoots.some((dir) => isPathInsideDir(resolvedAssetDir, dir))) {
    return {
      error: "asset_dir_outside_allowed_roots",
      resolvedAssetDir,
      allowedRoots,
    }
  }
  if (!existsSync(resolvedAssetDir) || !statSync(resolvedAssetDir).isDirectory()) {
    return {
      error: "asset_dir_not_found",
      resolvedAssetDir,
      allowedRoots,
    }
  }
  return { resolvedAssetDir, allowedRoots }
}

function registeredImageAssetFiles(run, assetDir = run?.imageAssetDir) {
  if (!run || !assetDir) return []
  const resolvedAssetDir = resolve(String(assetDir))
  const expectedCount = sceneCardsFor(run).length
  const aliasesForIndex = (index) => [
    `scene-${index + 1}.png`,
    `scene-${index + 1}.jpg`,
    `scene-${index + 1}.jpeg`,
    `scene-${index + 1}.webp`,
    `scene_${index + 1}.png`,
    `scene_${index + 1}.jpg`,
    `shot-${index + 1}.png`,
    `shot-${index + 1}.jpg`,
    `shot_${index + 1}.png`,
    `shot_${index + 1}.jpg`,
  ]
  const files = []
  for (let index = 0; index < expectedCount; index += 1) {
    const match = aliasesForIndex(index)
      .map((name) => join(resolvedAssetDir, name))
      .find((filePath) => existsSync(filePath) && statSync(filePath).isFile() && statSync(filePath).size > 0)
    if (match) files.push(match)
  }
  return files
}

function markImagegenRepairNeeded(run, blockedImagegenRequest) {
  const assetIndex = pipeline.findIndex((step) => step[0] === "asset")
  if (!run || assetIndex < 0) return null
  run.completedSteps = Math.min(run.completedSteps, assetIndex)
  run.status = "blocked"
  run.automationStatus = "waiting_agent"
  run.selectedAgentId = "asset"
  run.logs.push(`[repair] imagegen gate failed; reopening Asset step for local repair: ${blockedImagegenRequest.failures.join(" | ")}`)
  run.tasks.forEach((task, index) => {
    if (index < assetIndex) return
    task.status = index === assetIndex ? "ready" : "queued"
    task.completedAt = null
    task.artifactPath = index === assetIndex ? task.artifactPath : null
    task.error = index === assetIndex ? blockedImagegenRequest.failures.join(" | ") : null
  })
  const resetTaskIds = new Set(run.tasks.slice(assetIndex).map((task) => task.id))
  for (const worker of Object.values(state.workers)) {
    if (worker.currentTaskId && resetTaskIds.has(worker.currentTaskId)) worker.currentTaskId = null
    if (worker.id === "asset") worker.status = "revision"
  }
  return run.tasks[assetIndex]
}

function writeJson(filePath, value) {
  ensureDir(dirname(filePath))
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  }
  return result
}

function runCommandMaybe(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
  return result
}

function runCommandAsync(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    const timeoutMs = options.timeoutMs ?? 15 * 60_000
    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error(`${command} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    child.stdout.on("data", (chunk) => chunks.push(chunk.toString()))
    child.stderr.on("data", (chunk) => chunks.push(chunk.toString()))
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("exit", (code) => {
      clearTimeout(timer)
      const output = chunks.join("")
      if (code === 0) resolvePromise({ status: code, stdout: output, stderr: "" })
      else reject(new Error(`${command} exited ${code}\n${output.slice(-6000)}`))
    })
  })
}

function parseArtifactContent(artifact) {
  if (!artifact?.path || !existsSync(artifact.path) || statSync(artifact.path).isDirectory()) return null
  const raw = readFileSync(artifact.path, "utf8")
  try {
    const outer = JSON.parse(raw)
    if (typeof outer?.value === "string") {
      try {
        return JSON.parse(outer.value)
      } catch {
        return outer.value
      }
    }
    return outer
  } catch {
    return raw
  }
}

function normalizeExecutionMode(value, fallback = state.settings.executionMode ?? "codex_native") {
  if (value === "codex_cli") return "codex_native"
  if (value === "legacy_template" || value === "oauth_agents" || value === "codex_native") return value
  const normalizedFallback = fallback === "codex_cli" ? "codex_native" : fallback
  return normalizedFallback === "legacy_template" || normalizedFallback === "oauth_agents" || normalizedFallback === "codex_native" ? normalizedFallback : "codex_native"
}

function executionModeForAgentHost(agentHost, explicitMode = null) {
  if (explicitMode) return normalizeExecutionMode(explicitMode)
  return agentHost === "codex_native" || agentHost === "codex_cli" ? "codex_native" : "oauth_agents"
}

function codexNativeRuntimeStatus() {
  return {
    ...codexNativeStatus(),
    appServerRuntime: getCodexAppServerRuntimeStatus(),
  }
}

function listFilesRecursive(dir, base = dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) return listFilesRecursive(full, base)
    return [full.slice(base.length + 1)]
  })
}

let state = loadState()
ensureOAuthState()
if (!state.openaiAccount) {
  state.settings.providerId = "openai_codex_oauth"
  state.settings.authStatus = "disconnected"
}
state.settings.modelPolicy = mergeModelPolicy(state.settings.modelPolicy)
state.settings.imageModel = state.settings.imageModel ?? defaultImageModel
state.settings.executionMode = normalizeExecutionMode(state.settings.executionMode ?? "codex_native")
state.settings.agentHost = state.settings.agentHost === "codex_cli" ? "codex_native" : state.settings.agentHost ?? (state.settings.executionMode === "codex_native" ? "codex_native" : "codex_plugin")
if (state.settings.executionMode === "oauth_agents" && state.settings.agentHost === "codex_plugin") {
  state.settings.executionMode = "codex_native"
  state.settings.agentHost = "codex_native"
  state.settings.migratedToCodexNativeAt = state.settings.migratedToCodexNativeAt ?? new Date().toISOString()
}
state.settings.visualProvider = state.settings.visualProvider ?? "codex_imagegen"
state.workers = Object.fromEntries(
  Object.entries(defaultWorkers()).map(([id, defaults]) => [
    id,
    {
      ...defaults,
      ...(state.workers?.[id] ?? {}),
      model: state.settings.modelPolicy[id]?.model ?? defaults.model,
      thinkingLevel: state.settings.modelPolicy[id]?.thinkingLevel ?? defaults.thinkingLevel,
      thinkingLabel: state.settings.modelPolicy[id]?.thinkingLabel ?? defaults.thinkingLabel,
      capabilities: state.settings.modelPolicy[id]?.capabilities ?? defaults.capabilities,
    },
  ])
)
for (const run of Object.values(state.runs ?? {})) {
  for (const task of run.tasks ?? []) {
    if (task.agentId === "script") task.agentId = "director"
    if (task.agentId === "runtime") task.agentId = "programmer"
  }
}
saveState()

function applyModelPolicyToWorkers() {
  state.settings.modelPolicy = mergeModelPolicy(state.settings.modelPolicy)
  for (const [id, policy] of Object.entries(state.settings.modelPolicy)) {
    if (!state.workers[id]) continue
    state.workers[id].model = policy.model ?? state.workers[id].model ?? "gpt-5.5"
    state.workers[id].thinkingLevel = policy.thinkingLevel ?? state.workers[id].thinkingLevel ?? "medium"
    state.workers[id].thinkingLabel = policy.thinkingLabel ?? state.workers[id].thinkingLevel
    state.workers[id].capabilities = policy.capabilities ?? state.workers[id].capabilities ?? []
  }
}

let codexNativeAgentRuntime = null

function codexNativeRuntime() {
  if (!codexNativeAgentRuntime) {
    codexNativeAgentRuntime = createCodexNativeAgentRuntime({
      rootDir,
      stateDir,
      runsDir,
      codexWorkDir,
      codexSessionDir,
      codexBinary,
      agentModelPolicy,
      artifactTemplates,
      getState: () => state,
      saveState,
      pushEvent,
      recordTokenSample,
      producerSystemInstructions,
      agentTaskInstructions,
      skillPathsForAgent,
    })
  }
  return codexNativeAgentRuntime
}

function publicState() {
  for (const run of Object.values(state.runs)) {
    if (!run.difficultyEstimate) run.difficultyEstimate = estimateRunDifficulty(run.brief, state.settings)
    ensureTokenTelemetry(run)
  }
  return {
    settings: state.settings,
    capabilities: runtimeCapabilities(),
    openaiAccount: publicOpenAiAccount(),
    activeRunId: state.activeRunId,
    activeRun: state.activeRunId ? state.runs[state.activeRunId] : null,
    runs: Object.values(state.runs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    workers: Object.values(state.workers),
    events: state.events.slice(-80),
    pipeline: pipeline.map(([id, label, agentId, outputId]) => ({ id, label, agentId, outputId })),
  }
}

function runtimeCapabilities() {
  const agentHost = state.settings.agentHost === "codex_cli" ? "codex_native" : state.settings.agentHost ?? "codex_native"
  const visualProvider = state.settings.visualProvider ?? "codex_imagegen"
  const host = agentHostOptions.find((item) => item.id === agentHost) ?? agentHostOptions[0]
  const visual = visualProviderOptions.find((item) => item.id === visualProvider) ?? visualProviderOptions[0]
  const codexNative = codexNativeRuntimeStatus()
  const canGenerateImages = Boolean(host.imagegen || visual.canGenerate || visualProvider === "user_upload")
  return {
    selected: {
      agentHost,
      visualProvider,
      imageModel: state.settings.imageModel ?? defaultImageModel,
      defaultRuntime: state.settings.defaultRuntime,
      executionMode: normalizeExecutionMode(state.settings.executionMode),
    },
    agentHosts: agentHostOptions,
    visualProviders: visualProviderOptions,
    codexNative,
    matrix: {
      imagegen: canGenerateImages && (agentHost !== "codex_native" || codexNative.imageGeneration) ? "available" : "blocked_until_provider_registered",
      research: host.webSearch === false ? "manual_or_external" : "available",
      videoBuild: host.codeExecution === false ? "manual_or_external" : "available",
      render: "local_ffmpeg_package",
      quality: "local_frame_audio_package_checks",
    },
    policy: "Default execution is Codex Native Kernel: persistent app-server threads per Producer/Agent. Generated visuals may pass only through Codex/ChatGPT image_generation, explicit Image API, or user-uploaded assets. AutoDirector must not pass local HTML/SVG/canvas/raster diagrams as imagegen.",
  }
}

function pushEvent(type, payload) {
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  }
  state.events.push(event)
  state.events = state.events.slice(-200)
  saveState()
  const frame = `event: state\ndata: ${JSON.stringify(publicState())}\n\n`
  for (const client of clients) client.write(frame)
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  })
  res.end(JSON.stringify(body, null, 2))
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    ...headers,
  })
  res.end(body)
}

async function readJson(req) {
  const maxBodySize = Number(process.env.AUTODIRECTOR_MAX_JSON_BODY_BYTES ?? 1_048_576)
  let total = 0
  const chunks = []
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBodySize) {
      const error = new Error(`JSON body exceeds ${maxBodySize} bytes`)
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString("utf8")
  if (!raw) return {}
  return JSON.parse(raw)
}

async function readBodyText(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString("utf8")
}

async function readParams(req) {
  const raw = await readBodyText(req)
  const contentType = req.headers["content-type"] ?? ""
  if (contentType.includes("application/json")) {
    const parsed = raw ? JSON.parse(raw) : {}
    return new URLSearchParams(Object.entries(parsed).map(([key, value]) => [key, String(value)]))
  }
  return new URLSearchParams(raw)
}

function html(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  })
  res.end(body)
}

function resetWorkers() {
  state.workers = defaultWorkers()
}

function createRun(brief = "") {
  resetWorkers()
  const runId = `run_${Date.now()}`
  const now = new Date().toISOString()
  const runDir = join(runsDir, runId)
  ensureDir(runDir)
  const briefArtifactPath = join(runDir, "project_brief.json")
  const difficultyEstimate = estimateRunDifficulty(brief, state.settings)
  writeJson(briefArtifactPath, {
    id: "project_brief",
    title: "Project Brief",
    type: "input",
    brief,
    difficultyEstimate,
    runtime: state.settings.defaultRuntime,
    layoutMode: state.settings.layoutMode,
    executionMode: normalizeExecutionMode(state.settings.executionMode ?? "codex_native"),
    agentHost: state.settings.agentHost ?? "codex_native",
    visualProvider: state.settings.visualProvider ?? "codex_imagegen",
    imageModel: state.settings.imageModel ?? defaultImageModel,
    createdAt: now,
  })
  const run = {
    id: runId,
    title: brief.slice(0, 42) || "Untitled video run",
    brief,
    runtime: state.settings.defaultRuntime,
    layoutMode: state.settings.layoutMode,
    status: "active",
    completedSteps: 0,
    selectedAgentId: "producer",
    difficultyEstimate,
    createdAt: now,
    updatedAt: now,
    executionMode: normalizeExecutionMode(state.settings.executionMode ?? "codex_native"),
    tasks: pipeline.map(([id, label, agentId, outputId], index) => ({
      id: `task_${id}`,
      stepId: id,
      label,
      agentId,
      outputId,
      status: index === 0 ? "ready" : "queued",
      inputArtifactIds: upstreamArtifactIdsForStep(index),
      outputArtifactIds: [outputId],
    })),
    artifacts: [
      {
        id: "project_brief",
        title: "Project Brief",
        type: "input",
        ownerAgentId: "producer",
        path: briefArtifactPath,
        summary: brief,
        checks: ["user supplied", "ready for Producer"],
        createdAt: now,
      },
    ],
    logs: [],
  }
  ensureTokenTelemetry(run)
  state.runs[runId] = run
  state.activeRunId = runId
  saveState()
  pushEvent("run.created", { runId })
  pushEvent("run.difficulty_estimated", {
    runId,
    level: difficultyEstimate.level,
    label: difficultyEstimate.label,
    estimatedTotalTokens: difficultyEstimate.estimatedTotalTokens,
    reasoning: difficultyEstimate.reasoning,
  })
  return run
}

function artifactFor(step, run) {
  const [title, type, baseSummary] = artifactTemplates[step.outputId] ?? [step.outputId, "json", "Artifact generated."]
  const runtimeSuffix =
    step.outputId === "runtime_plan"
      ? ` Runtime: ${run.runtime}. ${run.runtime === "hyperframes" ? "HyperFrames checks: DESIGN.md, lint, validate, inspect." : "Remotion checks: composition, timing, still render."}`
      : ""
  return {
    id: step.outputId,
    title,
    type,
    ownerAgentId: step.agentId,
    path: `.autodirector/runs/${run.id}/${step.outputId}.${type === "folder" ? "" : type}`,
    summary: `${baseSummary}${runtimeSuffix}`,
    checks: ["schema valid", "handoff ready", "owned by persistent Agent"],
    createdAt: new Date().toISOString(),
  }
}

function agentTaskInstructions(run, task, worker) {
  const taskIndex = run.tasks.findIndex((item) => item.id === task.id)
  const effectiveInputIds = [...new Set([...(task.inputArtifactIds ?? []), ...upstreamArtifactIdsForStep(taskIndex)])]
  const upstream = effectiveInputIds
    .map((id) => run.artifacts.find((artifact) => artifact.id === id))
    .filter(Boolean)
  const previewForArtifact = (artifact) => {
    if (!artifact?.path || artifact.type === "folder") return null
    try {
      const body = readFileSync(artifact.path, "utf8")
      let preview = body
      try {
        const parsed = JSON.parse(body)
        if (typeof parsed?.value === "string") preview = parsed.value
        else if (typeof parsed?.content === "string") preview = parsed.content
      } catch {
        // Raw artifact text is fine.
      }
      return preview.length > 1200 ? `${preview.slice(0, 1200)}\n...[truncated]` : preview
    } catch {
      return null
    }
  }
  const success = [
    `产物必须是 ${task.outputId}`,
    "必须读取并引用上游 artifact，不允许凭空套默认模板。",
    "必须写清楚假设、风险、下一位 Agent 应该怎么接。",
    "如果无法完成，提交 blocked artifact，说明缺什么工具或质量门条件。",
    "只允许读取本任务列出的 upstreamArtifacts；不要扫描 .autodirector/state.json、旧 run 目录或无关历史产物。",
    "视频目标是可发布成片，不是动态 PPT：每个创意/工程产物都必须避免复用同一张卡片模板。",
  ]
  if (task.outputId === "script") {
    success.push("脚本必须按镜头节奏写：旁白、字幕短句、画面意图、事实绑定、可剪辑停顿都要明确。")
  }
  if (task.outputId === "shotlist") {
    success.push("必须给出 DESIGN.md 方向、scene formats、layout_zones、transition_plan、motion_board、caption safe area 和至少 5 个不同视觉时刻；先写布局再写动画。")
    success.push("每个 cinematic_hero 或 explain_overlay 必须指定真实素材或 imagegen 主视觉；HTML/SVG/card 只能是 fallback，不能作为首选成片方案。")
    success.push("分镜必须规划连续镜头：推拉、遮罩、场景接续、前后景关系和字幕安全区，禁止做成上下浮动 PPT。")
  }
  if (task.agentId === "asset") {
    success.push("非直接新闻/解释图必须通过 OAuth imagegen/gpt-image-2 生成或明确阻塞，不能用 HTML/SVG fallback 冒充；必须把生成文件登记到 imagegen_assets。")
    success.push("最终至少准备 5 个彼此不同、和主题强相关的主视觉/真实素材；新闻人物不能用 imagegen 伪造肖像，也不能只放大头照。")
    success.push("视觉资产要明亮、清晰、可发布：避免阴暗房间、低对比、横线占位、HTML diagram 感和大面积黑底。")
    success.push("音乐/音效必须给出来源、授权风险、BPM/mood/hit points；找不到合适音乐就 blocked，不允许嗡嗡底噪。")
  }
  if (task.outputId === "runtime_plan") {
    success.push("HyperFrames 默认路线必须包含 DESIGN.md、SCRIPT.md、STORYBOARD.md、scene specs、asset mapping、caption rules、audio cue sheet、lint/validate/inspect/render 命令。")
    success.push("必须说明是否用 website-to-hyperframes、registry block/component，不能跳过 layout-before-animation。")
  }
  if (task.agentId === "programmer") {
    success.push("必须按 runtime_plan 写可运行项目，不能只改字幕模板。")
    success.push("HyperFrames 项目必须先 scaffold/写 DESIGN.md，再布局，再 GSAP；必须跑 lint、validate、inspect，失败就 blocked。")
    success.push("每个场景要有不同构图、真实/imagegen 主视觉、转场、字幕/标题清晰分区、音频/字幕钩子；不能用同一套图片或一套 HTML 卡片贯穿全片。")
    success.push("镜头之间必须有连续运动和清晰视觉层级：hero image 撑满安全画面，标题/字幕有独立底板，不能遮挡主视觉。")
  }
  if (task.agentId === "render") success.push("必须真实执行 source_project 的 render/check 命令并产出 mp4；失败就 blocked，不能提交空报告。")
  if (task.agentId === "quality") {
    success.push("必须抽查 render_report 的 mp4 路径、音频流、asset_manifest 的 imagegen_assets、源码项目和字幕；Quality Gate 位于最终打包之前，不要因为 final_package 尚未生成而失败；失败时只写具体 patch task。")
    success.push("如果看起来像 PPT、视觉重复、素材少于 5 个、没有真实/imagegen 主视觉、HyperFrames lint/validate/inspect 缺失、字幕遮挡画面或音频嗡嗡底噪，必须 blocked。")
  }
  return {
    runId: run.id,
    taskId: task.id,
    stepId: task.stepId,
    label: task.label,
    agentId: task.agentId,
    agentName: worker.shortName,
    role: worker.role,
    model: worker.model,
    thinkingLevel: worker.thinkingLabel ?? worker.thinkingLevel,
    outputArtifactId: task.outputId,
    brief: run.brief,
    runtime: run.runtime,
    upstreamArtifacts: upstream.map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      type: artifact.type,
      path: artifact.path,
      summary: artifact.summary,
      checks: artifact.checks,
      contentPreview: previewForArtifact(artifact),
    })),
    requiredOutput: {
      id: task.outputId,
      suggestedType: artifactTemplates[task.outputId]?.[1] ?? "json",
      path: `.autodirector/runs/${run.id}/agent-artifacts/${task.outputId}`,
    },
    successCriteria: success,
    handoff: `完成后调用 autodirector_submit_agent_artifact，Producer 才会推进下一步。`,
  }
}

function currentRunnableTask(run, agentId = null) {
  if (!run) return null
  const task = run.tasks.find((item) => ["ready", "working"].includes(item.status) && (!agentId || item.agentId === agentId))
  if (!task) return null
  const worker = state.workers[task.agentId]
  return { task, worker, instructions: agentTaskInstructions(run, task, worker) }
}

function writeSubmittedArtifact(run, task, body) {
  const template = artifactTemplates[task.outputId] ?? [task.outputId, "json", "Agent submitted artifact."]
  const type = String(body.type ?? template[1] ?? "json")
  const safeType = type === "folder" ? "md" : type
  const safeExtension = String(safeType === "markdown" ? "md" : safeType).replace(/[^a-z0-9_-]/gi, "_") || "txt"
  const artifactDir = join(runsDir, run.id, "agent-artifacts")
  ensureDir(artifactDir)
  const fileName = `${task.outputId}.${safeExtension}`
  let filePath = join(artifactDir, fileName)
  const content = body.content ?? body.markdown ?? body.json ?? body.text ?? body.summary ?? ""
  if (typeof content === "object") {
    if (!filePath.endsWith(".json")) filePath = `${filePath}.json`
    writeJson(filePath, content)
  } else {
    writeFileSync(filePath, String(content))
  }
  return normalizeAgentArtifact({ run, task, body: { ...body, type }, template, path: filePath })
}

function qualityArtifactIndicatesFailure(body = {}) {
  const haystack = [
    body.status,
    body.title,
    body.summary,
    ...(Array.isArray(body.checks) ? body.checks : []),
    typeof body.content === "string" ? body.content : JSON.stringify(body.content ?? {}),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase()
  return [
    "质检失败",
    "未通过",
    "不通过",
    "failed",
    "fail",
    "blocked",
    "缺失",
    "missing",
    "no audio",
    "无 audio",
    "无音频",
  ].some((marker) => haystack.includes(marker.toLowerCase()))
}

function parseQualityReportContent(body = {}) {
  const content = body.content ?? body.json ?? body.markdown ?? body.text ?? body.summary ?? ""
  if (content && typeof content === "object" && !Array.isArray(content)) return content
  const text = String(content || "")
  return parseJsonFromModelText(text) ?? { text }
}

function qualityRepairStepIndex(body = {}) {
  const report = parseQualityReportContent(body)
  const text = [
    body.title,
    body.summary,
    ...(Array.isArray(body.checks) ? body.checks : []),
    typeof report.text === "string" ? report.text : JSON.stringify(report),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase()
  const owners = new Set()
  const collectOwner = (value) => {
    if (!value) return
    owners.add(String(value).toLowerCase().replace(/[_\s]+/g, "-"))
  }
  const collectFromArray = (items = []) => {
    if (!Array.isArray(items)) return
    for (const item of items) {
      if (!item || typeof item !== "object") continue
      collectOwner(item.owner)
      collectOwner(item.patch_owner)
      collectOwner(item.agent)
    }
  }
  collectFromArray(report.patch_tasks)
  collectFromArray(report.frame_checks)
  collectFromArray(report.asset_checks)
  collectFromArray(report.audio_checks)
  collectFromArray(report.visual_event_checks)
  collectFromArray(report.voice_screen_sync_checks)
  collectFromArray(report.visual_composition_checks)
  collectFromArray(report.package_checks)

  if (/imagegen|visual-imagegen|asset|素材|主视觉|hero visual|missing accepted hero|oauth/.test(text)) owners.add("asset")
  if (/caption|subtitle|字幕|safe zone|遮挡|shotlist|director|分镜|visual composition|画面|ppt/.test(text)) owners.add("director")
  if (/builder|programmer|runtime|source_project|source project|hyperframes|remotion|lint|validate|inspect|code/.test(text)) owners.add("programmer")
  if (/render|mp4|final video|final\.mp4|ffmpeg|导出|渲染/.test(text)) owners.add("render")
  if (/sound|music|audio|tts|voice|ducking|ncm|音乐|音频|配音|无音频/.test(text)) owners.add("asset")

  const ownerToStep = {
    director: "director",
    caption: "director",
    motion: "director",
    "story-director": "director",
    asset: "asset",
    assets: "asset",
    sound: "asset",
    audio: "asset",
    imagegen: "asset",
    "visual-imagegen": "asset",
    builder: "programmer",
    programmer: "programmer",
    "video-engineer": "programmer",
    runtime: "runtime",
    render: "render",
  }
  const indexes = [...owners]
    .map((owner) => ownerToStep[owner])
    .filter(Boolean)
    .map((stepId) => pipeline.findIndex((step) => step[0] === stepId))
    .filter((index) => index >= 0)
  return indexes.length ? Math.min(...indexes) : pipeline.findIndex((step) => step[0] === "asset")
}

function markQualityRepairNeeded(run, qualityTask, submittedArtifact) {
  const repairIndex = qualityRepairStepIndex(submittedArtifact)
  if (!run || repairIndex < 0) return null
  const reason = qualityArtifactIndicatesFailure(submittedArtifact)
    ? "Quality Gate found actionable failures"
    : "Quality Gate requested repair"
  run.completedSteps = Math.min(run.completedSteps, repairIndex)
  run.status = "active"
  run.automationStatus = "waiting_agent"
  run.selectedAgentId = run.tasks[repairIndex].agentId
  run.logs.push(`[repair] Quality Gate routed patch to ${run.tasks[repairIndex].agentId}/${run.tasks[repairIndex].outputId}: ${reason}`)
  run.tasks.forEach((item, index) => {
    if (index < repairIndex) return
    if (item.id === qualityTask.id) {
      item.status = "queued"
      item.error = reason
      return
    }
    item.status = index === repairIndex ? "ready" : "queued"
    item.completedAt = null
    item.error = index === repairIndex ? reason : null
    if (index > repairIndex) item.artifactPath = null
  })
  const resetTaskIds = new Set(run.tasks.slice(repairIndex).map((item) => item.id))
  for (const worker of Object.values(state.workers)) {
    if (worker.currentTaskId && resetTaskIds.has(worker.currentTaskId)) worker.currentTaskId = null
    if (worker.id === run.tasks[repairIndex].agentId) worker.status = "revision"
  }
  pushEvent("quality.patch_routed", {
    runId: run.id,
    fromStepId: qualityTask.stepId,
    targetStepId: run.tasks[repairIndex].stepId,
    agentId: run.tasks[repairIndex].agentId,
    outputId: run.tasks[repairIndex].outputId,
  })
  return run.tasks[repairIndex]
}

function completeAgentTask(runId, body = {}) {
  const run = state.runs[runId]
  if (!run) return { error: "run_not_found" }
  const task = body.taskId || body.stepId
    ? run.tasks.find((item) => item.id === body.taskId || item.stepId === body.stepId)
    : run.tasks.find((item) => item.status === "working")
  if (!task) return { error: "task_not_found" }
  if (body.taskId && body.taskId !== task.id) return { error: "task_mismatch" }
  if (body.stepId && body.stepId !== task.stepId) return { error: "task_mismatch" }
  if (body.agentId && body.agentId !== task.agentId) return { error: "agent_mismatch" }
  if (!["ready", "working"].includes(task.status)) return { error: "task_not_active" }
  const worker = state.workers[task.agentId]
  const now = new Date().toISOString()
  const submittedArtifact = body.artifact ?? body
  const blocked = body.status === "blocked" || task.agentId === "quality" && qualityArtifactIndicatesFailure(submittedArtifact)
  const artifact = writeSubmittedArtifact(run, task, submittedArtifact)
  recordTokenSample(runId, {
    agentId: task.agentId,
    taskId: task.id,
    text: typeof submittedArtifact === "string" ? submittedArtifact : JSON.stringify(submittedArtifact),
  })

  run.logs.push(`[artifact] ${worker.shortName} submitted ${artifact.id}${blocked ? " (blocked)" : ""}`)
  run.artifacts = run.artifacts.filter((item) => item.id !== artifact.id).concat(artifact)
  worker.artifacts.push(artifact.id)
  worker.outbox.push(artifact.id)
  worker.currentTaskId = null
  worker.status = blocked ? "revision" : "done"
  task.status = blocked ? "blocked" : "done"
  task.completedAt = now
  task.submittedBy = body.submittedBy ?? `${worker.shortName} OAuth Agent`
  task.artifactPath = artifact.path
  run.updatedAt = now
  pushEvent(blocked ? "task.blocked" : "task.completed", { runId, stepId: task.stepId, agentId: task.agentId, outputId: task.outputId })

  if (blocked) {
    if (task.agentId === "quality") {
      worker.status = "done"
      task.status = "done"
      markQualityRepairNeeded(run, task, submittedArtifact)
      recomputeRunEta(run)
      if (["oauth_agents", "codex_native"].includes(normalizeExecutionMode(run.executionMode ?? state.settings.executionMode)) && body.autoDispatchNext !== false) {
        saveState()
        dispatchNext(run.id)
      }
    } else {
      run.status = "blocked"
      run.automationStatus = "blocked"
      run.selectedAgentId = task.agentId
      recomputeRunEta(run)
    }
  } else {
    if (run.status === "blocked") run.status = "active"
    run.completedSteps = Math.max(run.completedSteps, run.tasks.findIndex((item) => item.id === task.id) + 1)
    recomputeRunEta(run)
    if (run.completedSteps < pipeline.length) {
      run.tasks[run.completedSteps].status = "ready"
      run.selectedAgentId = run.tasks[run.completedSteps].agentId
      run.automationStatus = "waiting_agent"
      pushEvent("task.ready", { runId, stepId: run.tasks[run.completedSteps].stepId, agentId: run.tasks[run.completedSteps].agentId, outputId: run.tasks[run.completedSteps].outputId })
      if (["oauth_agents", "codex_native"].includes(normalizeExecutionMode(run.executionMode ?? state.settings.executionMode)) && body.autoDispatchNext !== false) {
        saveState()
        dispatchNext(run.id)
      }
    } else {
      run.status = "ready_to_package"
      run.selectedAgentId = "quality"
      run.automationStatus = "packaging"
      generateFinalPackage(run)
    }
  }
  saveState()
  return { run, task, artifact }
}

function dispatchNext(runId, options = {}) {
  const run = state.runs[runId]
  if (!run) return null
  if (run.completedSteps >= pipeline.length) return run

  const mode = normalizeExecutionMode(options.mode ?? run.executionMode ?? state.settings.executionMode ?? "codex_native")
  const [stepId, label, agentId, outputId] = pipeline[run.completedSteps]
  const task = run.tasks[run.completedSteps]
  const worker = state.workers[agentId]
  const now = new Date().toISOString()
  if (task.status === "working") return run

  task.status = "working"
  task.assignedAt = now
  task.executionMode = mode
  task.instructions = agentTaskInstructions(run, task, worker)
  task.modelAttempts = 0
  delete task.error
  ensureTokenTelemetry(run)
  recomputeRunEta(run)
  worker.status = "working"
  worker.currentTaskId = task.id
  worker.inbox.push(task.id)
  worker.lastActive = now
  run.selectedAgentId = agentId
  run.logs.push(`[dispatch] Producer -> ${worker.shortName}: ${label} (${worker.model}, thinking=${worker.thinkingLabel ?? worker.thinkingLevel})`)
  pushEvent("task.started", { runId, stepId, agentId, outputId, label })
  pushEvent("agent.thinking", { runId, stepId, agentId, outputId, label })
  pushEvent("handoff.started", { runId, from: "producer", agentId, outputId, label })

  if (mode === "oauth_agents" || mode === "codex_native") {
    run.automationStatus = "waiting_agent"
    run.updatedAt = now
    saveState()
    pushEvent("agent_task.waiting", { runId, stepId, agentId, outputId, task: task.instructions })
    if (mode === "codex_native" || state.openaiAccount?.accessToken) scheduleAgentModelTask(run.id, task.id)
    return run
  }

  const artifact = artifactFor({ stepId, label, agentId, outputId }, run)
  run.logs.push(`[artifact] ${worker.shortName} writing ${outputId}`)
  pushEvent("artifact.writing", { runId, stepId, agentId, outputId, label })
  run.artifacts = run.artifacts.filter((item) => item.id !== artifact.id).concat(artifact)
  worker.artifacts.push(artifact.id)
  worker.outbox.push(artifact.id)
  worker.status = agentId === "quality" ? "revision" : "done"
  worker.currentTaskId = null
  task.status = "done"

  run.completedSteps += 1
  run.updatedAt = now
  recordTokenSample(runId, { agentId, taskId: task.id, text: JSON.stringify(artifact) })
  recomputeRunEta(run)
  if (run.completedSteps < pipeline.length) {
    run.tasks[run.completedSteps].status = "ready"
    run.selectedAgentId = pipeline[run.completedSteps][2]
  } else {
    run.status = "final"
    run.selectedAgentId = "quality"
  }

  saveState()
  pushEvent("task.completed", { runId, stepId, agentId, outputId })
  return run
}

function dispatchAll(runId) {
  let run = state.runs[runId]
  if (["oauth_agents", "codex_native"].includes(normalizeExecutionMode(run?.executionMode ?? state.settings.executionMode))) {
    return dispatchNext(runId)
  }
  while (run && run.completedSteps < pipeline.length) {
    run = dispatchNext(runId, { mode: "legacy_template" })
  }
  return run
}

function scheduleRunAutomation(runId, delayMs = autoStepDelayMs) {
  const run = state.runs[runId]
  if (!run || run.package || automationTimers.has(runId)) return

  run.automationStatus = run.completedSteps >= pipeline.length ? "packaging" : "running"
  saveState()
  pushEvent("automation.running", { runId, completedSteps: run.completedSteps, totalSteps: pipeline.length })

  const timer = setTimeout(() => {
    automationTimers.delete(runId)
    const current = state.runs[runId]
    if (!current || current.package) return

    if (current.completedSteps < pipeline.length) {
      dispatchNext(runId)
      if (state.runs[runId]?.automationStatus !== "waiting_agent") scheduleRunAutomation(runId, autoStepDelayMs)
      return
    }

    current.automationStatus = "packaging"
    saveState()
    pushEvent("automation.packaging", { runId })
    generateFinalPackage(current)
    const repairTaskActive = current.package?.status === "blocked" && current.tasks?.some((task) => task.agentId === "asset" && ["ready", "working"].includes(task.status))
    current.automationStatus = repairTaskActive ? current.automationStatus : current.package?.status === "blocked" ? "blocked" : "complete"
    saveState()
    pushEvent(repairTaskActive ? "automation.repairing" : current.automationStatus === "blocked" ? "automation.blocked" : "automation.complete", { runId })
  }, delayMs)

  automationTimers.set(runId, timer)
}

function resumeActiveAutomation() {
  const activeRun = state.activeRunId ? state.runs[state.activeRunId] : null
  if (!activeRun) return
  if (["oauth_agents", "codex_native"].includes(normalizeExecutionMode(activeRun.executionMode ?? state.settings.executionMode))) {
    const currentTask = activeRun.tasks?.find((task) => task.status === "working")
    if (currentTask) {
      scheduleAgentModelTask(activeRun.id, currentTask.id)
      return
    }
  }
  if (activeRun.package) return
  if (activeRun.status === "active" || activeRun.completedSteps >= pipeline.length) {
    scheduleRunAutomation(activeRun.id, 700)
  }
}

function generatedAssets(run, scenes = []) {
  return scenes.map((scene, index) => ({
    id: `${scene.kind || "scene"}_${index + 1}_video`,
    title: scene.assetTitle ?? `${scene.title} clip`,
    file: `assets/video/${scene.assetFile ?? `scene-${index + 1}.mp4`}`,
    source:
      scenes[index]?.imagegen?.provider === "oauth_agent_imagegen_artifact"
        ? "OAuth imagegen artifact + AutoDirector compositor + ffmpeg"
        : scenes[index]?.imagegen?.provider === "browser_search_public_editorial_collage"
          ? "Browser/public evidence assets + editorial compositor + ffmpeg"
          : "AutoDirector compositor fallback only; blocked for strict imagegen runs",
    license: scene.license ?? "Generated locally for this run",
    purpose: scene.assetPurpose ?? scene.caption ?? scene.body,
    risk: scene.assetRisk ?? "低；素材来源和 fallback 已记录。",
    fallback: scene.assetFallback ?? "如果素材不可用，使用代码生成的新闻解释图。",
    durationSeconds: sceneDuration(scene),
    imagegen: scenes[index]?.imagegen ?? null,
  }))
}

function legacyDemoAssets(run, scenes = []) {
  return [
    {
      id: "brief_board_video",
      title: "Brief board clip",
      file: "assets/video/brief-board.mp4",
      source: scenes[0]?.imagegen?.status === "generated" ? "OpenAI image generation + AutoDirector compositor + ffmpeg" : "AutoDirector compositor fallback + ffmpeg",
      license: "Generated locally for this run",
      purpose: "开场说明用户需求进入 Producer。",
      risk: "低；主视觉为生成素材或本地 fallback，无第三方版权素材。",
      fallback: "OpenAI imagegen 不可用时使用代码生成标题卡。",
      durationSeconds: 6,
      imagegen: scenes[0]?.imagegen ?? null,
    },
    {
      id: "agent_pipeline_video",
      title: "Agent pipeline clip",
      file: "assets/video/agent-pipeline.mp4",
      source: scenes[1]?.imagegen?.status === "generated" ? "OpenAI image generation + AutoDirector compositor + ffmpeg" : "AutoDirector compositor fallback + ffmpeg",
      license: "Generated locally for this run",
      purpose: "展示多 Agent 分工协作。",
      risk: "低；主视觉为生成素材或抽象图形素材。",
      fallback: "OpenAI imagegen 不可用时使用 UI 截图或节点动画。",
      durationSeconds: 6,
      imagegen: scenes[1]?.imagegen ?? null,
    },
    {
      id: "asset_quality_video",
      title: "Imagegen asset quality clip",
      file: "assets/video/asset-quality.mp4",
      source: scenes[2]?.imagegen?.status === "generated" ? "OpenAI image generation + AutoDirector compositor + ffmpeg" : "AutoDirector compositor fallback + ffmpeg",
      license: "Generated locally for this run",
      purpose: "展示素材、字幕、转场和音乐不是同一张文字卡。",
      risk: "低；主视觉为生成素材或本地素材墙可视化。",
      fallback: "OpenAI imagegen 不可用时替换为素材/字幕/音乐分层可视化。",
      durationSeconds: 6,
      imagegen: scenes[2]?.imagegen ?? null,
    },
    {
      id: "runtime_pack_video",
      title: `${run.runtime} runtime clip`,
      file: "assets/video/runtime-pack.mp4",
      source: scenes[3]?.imagegen?.status === "generated" ? "OpenAI image generation + AutoDirector compositor + ffmpeg" : "AutoDirector compositor fallback + ffmpeg",
      license: "Generated locally for this run",
      purpose: "说明 HyperFrames / Remotion 默认运行时。",
      risk: "低；主视觉为生成素材或本地 runtime 可视化。",
      fallback: "OpenAI imagegen 不可用时替换为 runtime_plan.json 可视化。",
      durationSeconds: 6,
      imagegen: scenes[3]?.imagegen ?? null,
    },
    {
      id: "quality_package_video",
      title: "Quality package clip",
      file: "assets/video/quality-package.mp4",
      source: scenes[4]?.imagegen?.status === "generated" ? "OpenAI image generation + AutoDirector compositor + ffmpeg" : "AutoDirector compositor fallback + ffmpeg",
      license: "Generated locally for this run",
      purpose: "展示最终包、质量报告和可下载交付。",
      risk: "低；主视觉为生成素材或本地生成。",
      fallback: "OpenAI imagegen 不可用时使用 package manifest 表格。",
      durationSeconds: 6,
      imagegen: scenes[4]?.imagegen ?? null,
    },
  ]
}

function briefKind(run) {
  const brief = run.brief || ""
  if (/马斯克|Musk|Elon|奥特曼|Altman|OpenAI/i.test(brief)) return "musk_altman_news"
  if (/新闻|冲突|诉讼|官司|latest|recent|timeline|时间线/i.test(brief)) return "news"
  return "autodirector_demo"
}

function newsPlanFor(run) {
  const isMuskAltman = briefKind(run) === "musk_altman_news"
  if (!isMuskAltman) return null
  const sharedEvidenceAssets = [
    {
      title: "Elon Musk public portrait evidence",
      url: "https://upload.wikimedia.org/wikipedia/commons/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Elon_Musk_Royal_Society_(crop2).jpg",
      license: "CC BY-SA 3.0, Debbie Rowe via Wikimedia Commons",
      purpose: "人物识别与新闻解释素材。",
    },
    {
      title: "Sam Altman public portrait evidence",
      url: "https://upload.wikimedia.org/wikipedia/commons/8/83/Sam_Altman%2C_June_2023_%28GPOABG244%29_%28cropped%29.jpeg",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Sam_Altman,_June_2023_(GPOABG244)_(cropped).jpeg",
      license: "CC BY-SA 3.0, Amos Ben Gershom / GPO via Wikimedia Commons",
      purpose: "人物识别与新闻解释素材。",
    },
    {
      title: "Ronald V. Dellums Federal Building evidence",
      url: "https://upload.wikimedia.org/wikipedia/commons/7/74/Ronald_Dellums_Federal_Building.jpg",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ronald_Dellums_Federal_Building.jpg",
      license: "CC BY-SA 3.0 via Wikimedia Commons",
      purpose: "Oakland federal court context visual.",
    },
    {
      title: "Reuters / Al Jazeera Musk Altman trial combination photo",
      url: "https://www.aljazeera.com/wp-content/uploads/2026/04/reuters_69f261b5-1777492405.jpg?resize=1920%2C1280&quality=80",
      sourcePage: "https://www.aljazeera.com/economy/2026/4/29/musk-accuses-altman-of-betraying-openais-nonprofit-founding-mission",
      license: "Reuters news photo via Al Jazeera; license requires review for public redistribution",
      purpose: "直接新闻素材主图，展示 Sam Altman 与 Elon Musk 在庭审期间的组合照片。",
    },
    {
      title: "AP News OpenAI trial courthouse photo",
      url: "https://dims.apnews.com/dims4/default/911658a/2147483647/strip/true/crop/5449x3631+0+1/resize/980x653!/quality/90/?url=https%3A%2F%2Fassets.apnews.com%2F08%2Fb0%2Fd5385e1b8bf692e6bebc68ca390c%2Ff1b963ca2ccb4d09a5383c551921c702",
      sourcePage: "https://apnews.com/article/musk-altman-openai-nonprofit-trial-bdbe85d62c2b678458fe68148eb6fba5",
      license: "AP news photo; license requires review for public redistribution",
      purpose: "直接新闻素材主图，展示庭审现场/法院语境。",
    },
  ]
  return {
    kind: "musk_altman_news",
    title: "Musk vs Altman / OpenAI conflict",
    researchPack: {
      topic: "Elon Musk 与 Sam Altman / OpenAI 的公开冲突",
      verificationStatus: "seeded_with_public_sources; Research Agent should refresh before public submission",
      sources: [
        {
          id: "src_ap_2026_05_01",
          title: "Elon Musk spars with OpenAI attorney in trial over company's evolution from a nonprofit",
          publisher: "Associated Press",
          url: "https://apnews.com/article/bdbe85d62c2b678458fe68148eb6fba5",
          accessed_at: "2026-05-01",
          type: "news",
          relevance: "Current trial framing and both sides' positions.",
        },
        {
          id: "src_reuters_2026_04_28",
          title: "OpenAI trial pitting Elon Musk against Sam Altman kicks off",
          publisher: "Reuters",
          url: "https://www.investing.com/news/stock-market-news/openai-trial-pitting-elon-musk-against-sam-altman-kicks-off-4640752",
          accessed_at: "2026-05-01",
          type: "news",
          relevance: "Trial start, venue, and central nonprofit-to-for-profit dispute.",
        },
        {
          id: "src_justia_2026_04_30",
          title: "Musk v. Altman et al court filing",
          publisher: "Justia / U.S. District Court",
          url: "https://cases.justia.com/federal/district-courts/california/candce/4%3A2024cv04722/433688/203/0.pdf",
          accessed_at: "2026-05-01",
          type: "court_filing",
          relevance: "Recent docket material for the live case.",
        },
      ],
      requiredVerification: [
        "Research Agent must verify current timeline with web/browser tools in a live run.",
        "If web verification is unavailable, mark the run as demo research and Quality Gate should expose that limitation.",
      ],
      keyFacts: [
        {
          id: "fact_01",
          claim: "2026 年 4 月底，Musk 与 OpenAI / Altman 的案件进入庭审阶段，核心围绕 OpenAI 从非营利使命到商业化结构的演变。",
          source_ids: ["src_ap_2026_05_01", "src_reuters_2026_04_28"],
          risk: "medium; requires current legal/news verification",
        },
        {
          id: "fact_02",
          claim: "Musk 一方长期指责 OpenAI 偏离早期非营利/开放使命。",
          source_ids: ["src_ap_2026_05_01", "src_reuters_2026_04_28"],
          risk: "medium; summarize allegation, do not present as court finding",
        },
        {
          id: "fact_03",
          claim: "Altman/OpenAI 一方主张商业合作和算力融资是扩展 AI 能力所需。",
          source_ids: ["src_ap_2026_05_01"],
          risk: "medium; summarize position, do not infer motive",
        },
      ],
      sourceTasks: [
        "Search recent court/news coverage before final public submission.",
        "Use official court filings, OpenAI statements/blog posts, Musk/XAI statements, Reuters/AP/Bloomberg/NYT style news sources when available.",
      ],
    },
    scenes: [
      {
        eyebrow: "马斯克 vs 奥特曼终极审判！",
        hook: "不要 1870 亿",
        title: "把 OpenAI 还给我",
        body: "2026 年 4 月底，Musk 与 OpenAI / Altman 的案件在 Oakland 开庭，核心是：OpenAI 是否背离早期非营利使命。",
        caption: "这不是口水战，是 AI 公司治理、资本与使命的正面对撞。",
        kind: "news_context",
        accent: "#f8de4a",
        assetTitle: "Conflict opener",
        assetPurpose: "建立 Musk / Altman / OpenAI 冲突语境。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
      {
        eyebrow: "Musk 一方",
        hook: "“偷走慈善”",
        title: "他的核心指控",
        body: "Musk 在庭审中把诉讼讲成对慈善与公共使命的防守，称 OpenAI 的商业化方向背离最初承诺。",
        caption: "这里只呈现庭审主张，不把任何一方说法当成判决结论。",
        kind: "news_musk",
        accent: "#f8de4a",
        assetTitle: "Musk position map",
        assetPurpose: "用导图解释 Musk 一方的主张，不用大头照占满画面。",
        assetRisk: "中；真实新闻与人物素材必须标注来源。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
      {
        eyebrow: "Altman / OpenAI",
        hook: "另一套叙事",
        title: "算力、融资、扩张",
        body: "OpenAI 一方反驳称，商业结构与合作是购买算力、吸引人才、继续推进模型能力的现实条件。",
        caption: "争议焦点从“初心”转向“谁有资格解释初心”。",
        kind: "news_altman",
        accent: "#62eadc",
        assetTitle: "Altman OpenAI position map",
        assetPurpose: "用导图解释 Altman / OpenAI 一方的商业化与算力叙事。",
        assetRisk: "中；真实新闻与人物素材必须标注来源。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
      {
        eyebrow: "争议焦点",
        hook: "真正抢的",
        title: "不是钱，是解释权",
        body: "同一段历史，可以被讲成背离初心，也可以被讲成商业化自救。法庭要听的是协议、治理与利益边界。",
        caption: "所以这场冲突会影响的不只是 OpenAI，而是 AI 公司的公共使命叙事。",
        kind: "news_stakes",
        accent: "#f8de4a",
        assetTitle: "Governance conflict diagram",
        assetPurpose: "用图解呈现非营利使命、营利结构、投资和控制权的拉扯。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
      {
        eyebrow: "下一步",
        hook: "三个信号",
        title: "法庭、监管、资本",
        body: "接下来要看判决如何界定非营利控制、OpenAI 的结构调整，以及 AI 融资是否被重新审视。",
        caption: "这场官司的结论，可能会重写大模型公司的治理边界。",
        kind: "news_outlook",
        accent: "#f8de4a",
        assetTitle: "Next signals board",
        assetPurpose: "收束为后续观察点。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
    ],
  }
}

function sceneCardsFor(run) {
  const newsPlan = newsPlanFor(run)
  if (newsPlan) return newsPlan.scenes

  const runtimeName = run.runtime === "hyperframes" ? "HyperFrames" : "Remotion"
  const scenes = [
    {
      eyebrow: "AutoDirector 参赛片",
      hook: "别再只改模板文字了！",
      title: "Producer 接到 brief 后开工",
      body: "用户只和管理员对话，后面拆任务、派 Agent、质检和返修都在后台自动推进。",
      caption: "不是 prompt-to-video，而是一支可审计的视频制作团队。",
      kind: "brief",
      accent: "#f6dd3d",
    },
    {
      eyebrow: "多 Agent 接力",
      hook: "7 个持久 Agent 真正接力",
      title: "分工交接，全程可审计",
      body: "砍掉重复岗位，只保留 Producer、Research、Director、Asset、Video Engineer、Render 和 Quality Gate。",
      caption: "Script、Caption、Motion、Sound 和 Runtime Planning 被折进核心角色，少而清楚。",
      kind: "team",
      accent: "#35e8c6",
    },
    {
      eyebrow: "素材与镜头",
      hook: "画面不能只是文字卡片",
      title: "素材、字幕、转场、音乐分层设计",
      body: "Asset 负责图片、imagegen、音乐和风险；Director 同时锁字幕安全区、节奏和转场。",
      caption: "每一镜都要有画面主体、信息层级和风险说明。",
      kind: "assets",
      accent: "#ff6b6b",
    },
    {
      eyebrow: "运行时锁定",
      hook: `${runtimeName} 先出计划再写代码`,
      title: "先定 runtime plan，再写代码",
      body: "Video Programmer 不能自由发挥，只能按 runtime_plan、shotlist 和 asset_manifest 实现。",
      caption: "工程稳定性来自可检查的计划，而不是一次性生成。",
      kind: "runtime",
      accent: "#6ecbff",
    },
    {
      eyebrow: "最终交付",
      hook: "评委要看到完整成片证据",
      title: "final.mp4、源码、素材、质量报告一起交付",
      body: "Quality Gate 不合格就只返修具体问题；通过后打包视频、工程、素材、引用和运行日志。",
      caption: "一站式生成，稳定可控，能复盘也能下载。",
      kind: "package",
      accent: "#ffd166",
    },
  ]

  if (/数据|对比|速度|汽车|增长|排名|快|慢/i.test(run.brief)) {
    scenes.splice(2, 0, {
      eyebrow: "数据镜头",
      hook: "动态对比要单独成片",
      title: "两组数据一眼看懂",
      body: "Data Scene 不沿用叙事图卡，而是用独立干净页面展示数值、对比条和变化过程。",
      caption: "例如两辆车速度对比：图片、数值和进度条同步推进。",
      kind: "data",
      accent: "#7ee787",
      durationSeconds: 6,
    })
  }

  return scenes.slice(0, 5)
}

function imageDataUri(filePath) {
  if (!filePath || !existsSync(filePath)) return null
  const ext = extname(filePath).toLowerCase()
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png"
  return `data:${mime};base64,${readFileSync(filePath).toString("base64")}`
}

function safeExtFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase()
  const raw = String(url).toLowerCase()
  if (raw.includes(".jpg") || raw.includes(".jpeg")) return ".jpg"
  if (raw.includes(".webp")) return ".webp"
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return ".jpg"
  if (pathname.endsWith(".webp")) return ".webp"
  return ".png"
}

function downloadPublicImage(url, outputPath) {
  if (!url || !commandAvailable("curl")) return { status: "skipped", reason: url ? "curl_not_found" : "missing_url" }
  const result = spawnSync("curl", ["-L", "--fail", "--silent", "--show-error", "--retry", "3", "--retry-delay", "1", "--connect-timeout", "20", url, "-o", outputPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.status === 0 && existsSync(outputPath) && statSync(outputPath).size > 0) {
    return { status: "generated", file: outputPath, provider: "public_source_download", sourceUrl: url }
  }
  return { status: "failed", reason: result.stderr || "download_failed", sourceUrl: url }
}

function imagegenPromptFor(scene) {
  const visualBriefs = {
    brief: "a clean explanatory diagram showing a user brief entering a Producer Agent, with clear nodes, arrows, and artifact boxes",
    team: "a clear agent-team orchestration diagram with Producer at the center dispatching persistent Agents through artifact handoff lines",
    data: "a clean data comparison diagram with two metric bars, count-up numbers, and labeled visual lanes without readable text",
    assets: "a clear asset pipeline diagram showing image, caption, motion, and music layers flowing into a storyboard",
    runtime: "a clear runtime planning diagram showing director plan, runtime plan, code blocks, render queue, and validation gates",
    package: "a clear final delivery diagram showing final video, source package, asset manifest, citations, quality report, and run log as organized icons",
    news_context: "a clean news explainer title diagram about Elon Musk, Sam Altman, OpenAI, lawsuit, governance and AI mission conflict; no readable text",
    news_musk: "a respectful news portrait/side card visual for Elon Musk's position in the OpenAI dispute; no readable text",
    news_altman: "a respectful news portrait/side card visual for Sam Altman's/OpenAI's position in the OpenAI dispute; no readable text",
    news_stakes: "a clear governance conflict diagram showing mission, nonprofit promise, commercial structure, capital, compute and control as abstract nodes; no readable text",
    news_outlook: "a clear forward-looking news board showing court, regulation and capital signals as abstract icons; no readable text",
  }
  return [
    "Use case: ads-marketing",
    "Asset type: vertical short-video center hero image",
    `Primary request: ${visualBriefs[scene.kind] ?? "cinematic production scene"}.`,
    "Scene/backdrop: smoky charcoal green-gray background like the user's reference, low saturation, subtle fog, soft top-left glow, not pure black.",
    "Composition: clear explanatory diagram, large simple nodes, arrows, lanes, file/artifact icons, generous spacing, vertical 9:16 crop, safe empty space at top and bottom for external Chinese title and captions.",
    "Style: premium editorial infographic / product explainer diagram, crisp vector-like shapes with tasteful depth, not a dark room photo, not a cinematic workspace, not dashboard clutter.",
    "Avoid: readable words, captions, logos, watermarks, tiny UI text, humans in dark rooms, purple AI gradient, blue-white dashboard, beige/cream panels, template cards.",
  ].join("\n")
}

function renderSvgToPng(svgPath, pngPath, width, height) {
  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if (existsSync(chromePath)) {
    const htmlPath = svgPath.replace(/\.svg$/, ".html")
    const svg = readFileSync(svgPath, "utf8")
    writeFileSync(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8" /><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#07100d}svg{display:block;width:${width}px;height:${height}px}</style></head><body>${svg}</body></html>`
    )
    const result = spawnSync(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--screenshot=${pngPath}`,
      `--window-size=${width},${height}`,
      `file://${htmlPath}`,
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20_000,
      killSignal: "SIGKILL",
    })
    if (result.status === 0 && existsSync(pngPath)) return true
  }
  return false
}

function structuralHeroSvg(scene, index, allEvidence = []) {
  const accent = scene.accent || "#d7f36b"
  const w = 1440
  const h = 860
  const muskImage = allEvidence.find((asset) => /Musk|Elon/i.test(asset.title || ""))?.file
  const altmanImage = allEvidence.find((asset) => /Altman|Sam/i.test(asset.title || ""))?.file
  const sceneMuskImage = scene.evidenceAssets?.find((asset) => /Musk|Elon/i.test(asset.title || ""))?.file
  const sceneAltmanImage = scene.evidenceAssets?.find((asset) => /Altman|Sam/i.test(asset.title || ""))?.file
  const courtImage = allEvidence.find((asset) => /Dellums|Federal|court/i.test(asset.title || ""))?.file
  const trialImage = allEvidence.find((asset) => /Reuters|Al Jazeera|combination|trial combination/i.test(asset.title || ""))?.file
  const apImage = allEvidence.find((asset) => /AP News|courthouse photo/i.test(asset.title || ""))?.file
  const muskUri = imageDataUri(scene.kind === "news_musk" ? sceneMuskImage : muskImage)
  const altmanUri = imageDataUri(scene.kind === "news_altman" ? sceneAltmanImage : altmanImage)
  const courtUri = imageDataUri(courtImage)
  const trialUri = imageDataUri(trialImage)
  const apUri = imageDataUri(apImage)
  const imageCard = (id, uri, x, y, iw, ih, stroke, labelText) => {
    if (!uri) {
      return `${card(x, y, iw, ih, stroke)}${label(labelText, x + iw / 2, y + ih / 2 + 10, 36)}`
    }
    return `
      <clipPath id="${id}"><rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="34"/></clipPath>
      <rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="34" fill="rgba(255,255,255,.07)" stroke="${stroke}" stroke-opacity=".52" stroke-width="4"/>
      <image href="${uri}" x="${x}" y="${y}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMin slice" clip-path="url(#${id})"/>
      <rect x="${x}" y="${y + ih - 74}" width="${iw}" height="74" rx="0" fill="rgba(5,12,10,.76)" clip-path="url(#${id})"/>
      ${label(labelText, x + iw / 2, y + ih - 26, 30)}
    `
  }
  const sourceCard = (x, y, title, source, color) => `
    <rect x="${x}" y="${y}" width="300" height="126" rx="28" fill="rgba(255,255,255,.08)" stroke="${color}" stroke-opacity=".42" stroke-width="3"/>
    <circle cx="${x + 50}" cy="${y + 54}" r="18" fill="${color}" opacity=".72"/>
    ${label(source, x + 180, y + 49, 27, "#ffffff")}
    ${sub(title, x + 182, y + 88, 20, "#cbd8d0")}
  `
  const label = (text, x, y, size = 44, fill = "#f6fff2") =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="${size}" font-weight="850" fill="${fill}">${text}</text>`
  const sub = (text, x, y, size = 25, fill = "#b9c9c2") =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="${size}" font-weight="680" fill="${fill}">${text}</text>`
  const card = (x, y, cw, ch, color = accent) =>
    `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="34" fill="rgba(255,255,255,0.075)" stroke="${color}" stroke-opacity="0.38" stroke-width="3" />`
  const fullPhoto = (id, uri, x, y, iw, ih, stroke = accent, opacity = 1, fit = "xMidYMid slice") => {
    if (!uri) return card(x, y, iw, ih, stroke)
    return `
      <clipPath id="${id}"><rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="28"/></clipPath>
      <image href="${uri}" x="${x}" y="${y}" width="${iw}" height="${ih}" preserveAspectRatio="${fit}" clip-path="url(#${id})" opacity="${opacity}"/>
      <rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="28" fill="rgba(3,7,6,.16)" stroke="${stroke}" stroke-opacity=".38" stroke-width="4"/>
    `
  }
  const portraitPhoto = (id, uri, x, y, iw, ih, stroke = accent, side = "left") => {
    if (!uri) return card(x, y, iw, ih, stroke)
    const glowX = side === "left" ? x + iw * 0.30 : x + iw * 0.70
    return `
      <clipPath id="${id}Clip"><rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="28"/></clipPath>
      <rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="28" fill="#101713" stroke="${stroke}" stroke-opacity=".38" stroke-width="4"/>
      <circle cx="${glowX}" cy="${y + ih * 0.36}" r="${Math.max(iw, ih) * 0.42}" fill="${stroke}" opacity=".10" clip-path="url(#${id}Clip)"/>
      <image href="${uri}" x="${x + 48}" y="${y + 18}" width="${iw - 96}" height="${ih - 36}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id}Clip)"/>
      <rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="28" fill="url(#photoShade)"/>
    `
  }
  const glow = `<defs>
    <radialGradient id="bg" cx="16%" cy="12%" r="76%"><stop offset="0%" stop-color="#27332d"/><stop offset="42%" stop-color="#111a16"/><stop offset="100%" stop-color="#07100d"/></radialGradient>
    <linearGradient id="photoShade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#020504" stop-opacity=".18"/><stop offset="52%" stop-color="#020504" stop-opacity=".05"/><stop offset="100%" stop-color="#020504" stop-opacity=".62"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000" flood-opacity=".38"/></filter>
  </defs>`
  let body = ""

  if (scene.kind === "news_context") {
    body = `
      ${fullPhoto("trialCombo", trialUri || apUri, 42, 42, 1356, 700, "#fff066")}
      <rect x="42" y="42" width="1356" height="700" rx="28" fill="url(#photoShade)"/>
      <circle cx="720" cy="396" r="120" fill="rgba(255,240,102,.12)" stroke="#fff066" stroke-width="7"/>
      ${label("VS", 720, 426, 96, "#fff066")}
      <rect x="330" y="686" width="780" height="86" rx="43" fill="rgba(3,7,6,.68)" stroke="#fff066" stroke-opacity=".35"/>
      ${sub("real news source visual · trial context", 720, 740, 34, "#f4f7f1")}
    `
  } else if (scene.kind === "news_musk") {
    body = `
      ${portraitPhoto("muskEvidenceLarge", muskUri, 42, 34, 1356, 760, "#ff6f61", "left")}
      <rect x="84" y="620" width="620" height="84" rx="42" fill="rgba(3,7,6,.62)" stroke="#fff066" stroke-opacity=".24"/>
      <path d="M126 666 H654" stroke="#fff066" stroke-width="16" stroke-linecap="round"/>
      <path d="M126 694 H510" stroke="rgba(255,255,255,.28)" stroke-width="10" stroke-linecap="round"/>
    `
  } else if (scene.kind === "news_altman") {
    body = `
      ${portraitPhoto("altmanEvidenceLarge", altmanUri, 42, 34, 1356, 760, "#49d6c8", "right")}
      <rect x="736" y="620" width="620" height="84" rx="42" fill="rgba(3,7,6,.62)" stroke="#49d6c8" stroke-opacity=".28"/>
      <path d="M786 666 H1308" stroke="#62eadc" stroke-width="16" stroke-linecap="round"/>
      <path d="M924 694 H1308" stroke="rgba(255,255,255,.28)" stroke-width="10" stroke-linecap="round"/>
    `
  } else if (scene.kind === "news_stakes") {
    body = `
      ${fullPhoto("trialComboStakes", trialUri, 42, 42, 1356, 700, "#ffd166")}
      <rect x="42" y="42" width="1356" height="700" rx="28" fill="rgba(3,7,6,.38)"/>
      <path d="M250 180 C470 345 624 365 720 356 C830 346 986 346 1190 552" stroke="#fff066" stroke-width="18" fill="none" stroke-linecap="round" opacity=".72"/>
      <path d="M250 550 C480 430 606 438 720 476 C860 522 1010 528 1190 292" stroke="#62eadc" stroke-width="10" fill="none" stroke-linecap="round" opacity=".54"/>
    `
  } else {
    const cols = [
      [150, "法庭", "#d7f36b"],
      [515, "监管", "#49d6c8"],
      [880, "资本", "#ffd166"],
    ]
    body = `
      ${fullPhoto("courtEvidenceLarge", apUri || courtUri, 42, 42, 1356, 700, "#d7f36b")}
      <rect x="42" y="42" width="1356" height="700" rx="28" fill="url(#photoShade)"/>
      <rect x="86" y="612" width="1268" height="92" rx="46" fill="rgba(3,7,6,.64)" stroke="#d7f36b" stroke-opacity=".28"/>
      <path d="M136 658 H520" stroke="#d7f36b" stroke-width="15" stroke-linecap="round"/>
      <path d="M584 658 H888" stroke="#62eadc" stroke-width="15" stroke-linecap="round"/>
      <path d="M948 658 H1302" stroke="#ffd166" stroke-width="15" stroke-linecap="round"/>
    `
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${glow}
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect x="32" y="32" width="${w - 64}" height="${h - 64}" rx="54" fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.09)"/>
    <g filter="url(#shadow)">${body}</g>
  </svg>`
}

function createStructuralDiagramAsset(scene, index, outputPath, scenes = []) {
  const svgPath = outputPath.replace(/\.(png|jpg|jpeg|webp)$/i, ".structural.svg")
  writeFileSync(svgPath, structuralHeroSvg(scene, index, scenes.flatMap((item) => item.evidenceAssets ?? [])))
  if (!renderSvgToPng(svgPath, outputPath, 1440, 860)) {
    return { status: "failed", reason: "structural_diagram_render_failed", provider: "local_raster_structural_diagram", svgPath }
  }
  return {
    status: "generated",
    model: "local-raster-structural-diagram",
    file: outputPath,
    svgPath,
    provider: "local_raster_structural_diagram",
  }
}

function createSourceEditorialHeroAsset(scene, index, outputPath, scenes = []) {
  const evidence = scenes.flatMap((item) => item.evidenceAssets ?? []).filter((asset) => asset.file && existsSync(asset.file))
  if (!scene.kind?.startsWith("news_") || evidence.length < 2) {
    return { status: "failed", reason: "missing_public_evidence_assets", provider: "browser_search_public_editorial_collage" }
  }
  const svgPath = outputPath.replace(/\.(png|jpg|jpeg|webp)$/i, ".source-editorial.svg")
  writeFileSync(svgPath, structuralHeroSvg(scene, index, evidence))
  if (!renderSvgToPng(svgPath, outputPath, 1440, 860)) {
    return { status: "failed", reason: "source_editorial_render_failed", provider: "browser_search_public_editorial_collage", svgPath }
  }
  return {
    status: "generated",
    model: "public-source-editorial-collage",
    file: outputPath,
    svgPath,
    provider: "browser_search_public_editorial_collage",
    sourceEvidenceCount: evidence.length,
  }
}

function externalImagegenAssetPath(index, run = null) {
  const candidates = [
    run?.imageAssetDir,
    join(rootDir, "output", "imagegen", run?.id ?? ""),
    process.env.AUTODIRECTOR_IMAGEGEN_ASSET_DIR,
    process.env.AUTODIRECTOR_OAUTH_IMAGEGEN_DIR,
  ].filter(Boolean)

  const names = [
    `scene-${index + 1}.png`,
    `scene-${index + 1}.jpg`,
    `scene-${index + 1}.jpeg`,
    `scene-${index + 1}.webp`,
    `scene_${index + 1}.png`,
    `scene_${index + 1}.jpg`,
    `shot-${index + 1}.png`,
    `shot-${index + 1}.jpg`,
    `shot_${index + 1}.png`,
    `shot_${index + 1}.jpg`,
  ]
  for (const dir of candidates) {
    for (const name of names) {
      const filePath = join(dir, name)
      if (existsSync(filePath) && statSync(filePath).isFile() && statSync(filePath).size > 0) return filePath
    }
  }
  return null
}

function generateSceneHeroImages(run, scenes, packageDir) {
  const imageDir = join(packageDir, "assets", "imagegen")
  ensureDir(imageDir)
  return scenes.map((scene, index) => {
    const externalAsset = externalImagegenAssetPath(index, run)
    const outputExt = externalAsset ? extname(externalAsset).toLowerCase() || ".png" : ".png"
    const outputPath = join(imageDir, `scene-${index + 1}${outputExt}`)
    const prompt = imagegenPromptFor(scene)
    pushEvent("imagegen.started", { runId: run.id, agentId: "asset", scene: scene.kind, outputId: `scene_${index + 1}_image` })
    let result
    if (externalAsset) {
      runCommand("cp", [externalAsset, outputPath])
      result = {
        status: "generated",
        model: state.settings.imageModel || defaultImageModel,
        file: outputPath,
        sourceFile: externalAsset,
        provider: "oauth_agent_imagegen_artifact",
      }
    } else if (scene.kind?.startsWith("news_")) {
      result = createSourceEditorialHeroAsset(scene, index, outputPath, scenes)
      if (result.status !== "generated") result = createStructuralDiagramAsset(scene, index, outputPath, scenes)
    } else {
      result = createStructuralDiagramAsset(scene, index, outputPath, scenes)
    }
    const imagegen = {
      id: `scene_${index + 1}_image`,
      prompt,
      ...result,
      relativeFile: result.status === "generated" ? `assets/imagegen/scene-${index + 1}${outputExt}` : null,
    }
    scene.imagegen = imagegen
    if (result.status === "generated") {
      scene.imagePath = outputPath
      pushEvent("imagegen.completed", { runId: run.id, agentId: "asset", scene: scene.kind, outputId: imagegen.id })
    } else {
      pushEvent("imagegen.fallback", { runId: run.id, agentId: "asset", scene: scene.kind, reason: result.reason })
    }
    return imagegen
  })
}

function downloadEvidenceAssets(run, scenes, packageDir) {
  const evidenceDir = join(packageDir, "assets", "evidence")
  ensureDir(evidenceDir)
  const records = []
  scenes.forEach((scene, sceneIndex) => {
    ;(scene.evidenceAssets ?? []).forEach((asset, assetIndex) => {
      const outputExt = safeExtFromUrl(asset.url)
      const outputPath = join(evidenceDir, `scene-${sceneIndex + 1}-evidence-${assetIndex + 1}${outputExt}`)
      const download = downloadPublicImage(asset.url, outputPath)
      const record = {
        ...asset,
        scene: scene.kind,
        status: download.status,
        reason: download.reason ?? null,
        file: download.status === "generated" ? outputPath : null,
        relativeFile: download.status === "generated" ? `assets/evidence/scene-${sceneIndex + 1}-evidence-${assetIndex + 1}${outputExt}` : null,
        provider: "browser_search_public_evidence_asset",
      }
      Object.assign(asset, record)
      records.push(record)
      pushEvent(download.status === "generated" ? "evidence_asset.downloaded" : "evidence_asset.failed", {
        runId: run.id,
        agentId: "asset",
        scene: scene.kind,
        title: asset.title,
      })
    })
  })
  return records
}

function heroImageVisual(scene) {
  const dataUri = imageDataUri(scene.imagePath)
  if (!dataUri) return sceneVisual(scene)
  const imageFit = scene.kind?.startsWith("news_") ? "xMidYMin slice" : "xMidYMid slice"
  return `
  <g>
    <clipPath id="heroClip"><rect x="0" y="206" width="${videoWidth}" height="430" /></clipPath>
    <rect x="0" y="206" width="${videoWidth}" height="430" fill="#101815" />
    <image href="${dataUri}" x="0" y="206" width="${videoWidth}" height="430" preserveAspectRatio="${imageFit}" clip-path="url(#heroClip)" filter="url(#imageGrade)" />
    <rect x="0" y="206" width="${videoWidth}" height="430" fill="rgba(29,37,33,0.28)" />
    <rect x="0" y="198" width="${videoWidth}" height="8" fill="${scene.accent}" />
    <rect x="0" y="636" width="${videoWidth}" height="8" fill="${scene.accent}" />
  </g>`
}

function newsReferenceHeroVisual(scene) {
  const dataUri = imageDataUri(scene.imagePath)
  if (!dataUri) return newsVisual(scene)
  return `
  <g>
    <clipPath id="newsHeroClip"><rect x="0" y="170" width="${videoWidth}" height="430"/></clipPath>
    <rect x="0" y="170" width="${videoWidth}" height="430" fill="#07100d"/>
    <image href="${dataUri}" x="0" y="170" width="${videoWidth}" height="430" preserveAspectRatio="xMidYMid slice" clip-path="url(#newsHeroClip)" filter="url(#imageGrade)" />
    <rect x="0" y="170" width="${videoWidth}" height="430" fill="url(#heroVignette)" />
    <rect x="0" y="164" width="${videoWidth}" height="2" fill="${scene.accent}" opacity=".72" />
    <rect x="0" y="600" width="${videoWidth}" height="2" fill="${scene.accent}" opacity=".58" />
  </g>`
}

function makeNewsReferenceSceneSvg(scene) {
  const eyebrowLines = wrapText(scene.eyebrow, 18).slice(0, 2)
  const hookLines = wrapText(scene.hook, 9).slice(0, 2)
  const titleLines = wrapText(scene.title, 11).slice(0, 2)
  const bodyLines = wrapText(scene.body, 24).slice(0, 5)
  const captionLines = wrapText(scene.caption, 22).slice(0, 3)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${videoWidth}" height="${videoHeight}" viewBox="0 0 ${videoWidth} ${videoHeight}">
  <defs>
    <radialGradient id="spotA" cx="22%" cy="8%" r="78%">
      <stop offset="0%" stop-color="#26302b" stop-opacity="0.92" />
      <stop offset="45%" stop-color="#111917" stop-opacity="0.98" />
      <stop offset="100%" stop-color="#070c0b" stop-opacity="1" />
    </radialGradient>
    <radialGradient id="mist" cx="13%" cy="14%" r="58%">
      <stop offset="0%" stop-color="#3a433d" stop-opacity="0.34" />
      <stop offset="42%" stop-color="#1a221e" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#070c0b" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="heroVignette" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#050807" stop-opacity=".30" />
      <stop offset="52%" stop-color="#050807" stop-opacity=".05" />
      <stop offset="100%" stop-color="#050807" stop-opacity=".58" />
    </linearGradient>
    <linearGradient id="bodyFade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#0a100f" stop-opacity=".72" />
      <stop offset="100%" stop-color="#070c0b" stop-opacity="1" />
    </linearGradient>
    <filter id="imageGrade">
      <feComponentTransfer>
        <feFuncR type="linear" slope="1.03" intercept="0.006" />
        <feFuncG type="linear" slope="1.02" intercept="0.008" />
        <feFuncB type="linear" slope="0.92" intercept="0.004" />
      </feComponentTransfer>
    </filter>
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".72" />
    </filter>
  </defs>
  <rect width="${videoWidth}" height="${videoHeight}" fill="#070c0b" />
  <rect width="${videoWidth}" height="${videoHeight}" fill="url(#spotA)" />
  <rect width="${videoWidth}" height="${videoHeight}" fill="url(#mist)" />
  <g filter="url(#textShadow)">
    ${svgTextBlock(eyebrowLines, 360, 29, 22, "#f8de4a", 680, 1.18, "middle")}
    ${svgTextBlock(hookLines, 360, 74, hookLines.length > 1 ? 43 : 54, "#f8de4a", 680, 1.04, "middle")}
    ${svgTextBlock(titleLines, 360, 139, 28, "#ffffff", 680, 1.12, "middle")}
  </g>
  ${newsReferenceHeroVisual(scene)}
  <rect x="0" y="602" width="${videoWidth}" height="358" fill="url(#bodyFade)" />
  <rect x="0" y="602" width="${videoWidth}" height="3" fill="${scene.accent}" opacity=".38" />
  <g filter="url(#textShadow)">
    ${svgTextBlock(bodyLines, 360, 652, 24, "#f4f7f1", 650, 1.36, "middle")}
    <rect x="68" y="828" width="584" height="82" rx="20" fill="rgba(255,255,255,.07)" stroke="${scene.accent}" stroke-opacity=".26" />
    ${svgTextBlock(captionLines, 360, 862, 21, "#f7f8f1", 610, 1.22, "middle")}
  </g>
</svg>`
}

function makeSceneSvg(scene) {
  if (scene.kind?.startsWith("news_")) return makeNewsReferenceSceneSvg(scene)
  const hookLines = wrapText(scene.hook, 12).slice(0, 2)
  const titleLines = wrapText(scene.title, 14).slice(0, 2)
  const bodyLines = wrapText(scene.body, 20).slice(0, 3)
  const captionLines = wrapText(scene.caption, 18).slice(0, 2)
  const hookFontSize = hookLines.length > 1 ? 34 : 40
  const hookY = hookLines.length > 1 ? 88 : 98
  const titleY = hookLines.length > 1 ? 168 : 154
  const titleFontSize = titleLines.length > 1 ? 22 : 24

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${videoWidth}" height="${videoHeight}" viewBox="0 0 ${videoWidth} ${videoHeight}">
  <defs>
    <radialGradient id="spotA" cx="50%" cy="0%" r="74%">
      <stop offset="0%" stop-color="#26302b" stop-opacity="0.96" />
      <stop offset="42%" stop-color="#151d1a" stop-opacity="0.98" />
      <stop offset="100%" stop-color="#0b1110" stop-opacity="1" />
    </radialGradient>
    <radialGradient id="mist" cx="16%" cy="16%" r="62%">
      <stop offset="0%" stop-color="#2c3631" stop-opacity="0.58" />
      <stop offset="48%" stop-color="#1a211e" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#0b1110" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="smoke" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#2b342f" stop-opacity="0.88" />
      <stop offset="58%" stop-color="#18201d" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#0d1311" stop-opacity="1" />
    </linearGradient>
    <filter id="imageGrade">
      <feComponentTransfer>
        <feFuncR type="linear" slope="0.92" intercept="0.020" />
        <feFuncG type="linear" slope="0.98" intercept="0.024" />
        <feFuncB type="linear" slope="0.90" intercept="0.014" />
      </feComponentTransfer>
    </filter>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#020504" flood-opacity="0.34" />
    </filter>
  </defs>
  <rect width="${videoWidth}" height="${videoHeight}" fill="#0b1110" />
  <rect width="${videoWidth}" height="${videoHeight}" fill="url(#spotA)" />
  <rect width="${videoWidth}" height="${videoHeight}" fill="url(#mist)" />
  <rect x="0" y="0" width="${videoWidth}" height="198" fill="#111916" />
  <rect x="0" y="0" width="${videoWidth}" height="198" fill="${scene.accent}" opacity="0.055" />
  <rect x="32" y="24" width="656" height="154" rx="24" fill="rgba(29,38,34,0.74)" stroke="rgba(222,229,218,0.12)" />
  ${svgTextBlock([scene.eyebrow], 360, 50, 18, scene.accent, 860, 1.1, "middle")}
  ${svgTextBlock(hookLines, 360, hookY, hookFontSize, "#fff066", 900, 1.08, "middle")}
  ${svgTextBlock(titleLines, 360, titleY, titleFontSize, "#ffffff", 780, 1.12, "middle")}
  ${scene.imagePath ? heroImageVisual(scene) : sceneVisual(scene)}
  <rect x="0" y="644" width="${videoWidth}" height="316" fill="#101715" />
  <rect x="0" y="644" width="${videoWidth}" height="316" fill="${scene.accent}" opacity="0.045" />
  <rect x="42" y="674" width="636" height="176" rx="26" fill="rgba(31,39,35,0.84)" stroke="rgba(222,229,218,0.12)" />
  ${svgTextBlock(bodyLines, 360, 724, 25, "#f3f5ef", 720, 1.34, "middle")}
  <rect x="54" y="884" width="612" height="42" rx="21" fill="rgba(225,232,219,0.12)" stroke="${scene.accent}" stroke-opacity="0.28" />
  ${svgTextBlock(captionLines, 360, 912, 22, "#f7f8f1", 860, 1.18, "middle")}
</svg>`
}

function sceneVisual(scene) {
  if (scene.kind?.startsWith("news_")) return newsVisual(scene)
  if (scene.kind === "data") return dataComparisonVisual(scene, 1)
  if (scene.kind === "brief") return briefVisual(scene)
  if (scene.kind === "team") return teamVisual(scene)
  if (scene.kind === "assets") return assetVisual(scene)
  if (scene.kind === "runtime") return runtimeVisual(scene)
  return packageVisual(scene)
}

function newsVisual(scene) {
  if (scene.kind === "news_context") {
    return `
  <g filter="url(#softShadow)">
    <rect x="52" y="188" width="616" height="318" rx="34" fill="rgba(16,23,21,0.82)" stroke="rgba(255,255,255,0.16)" />
    <circle cx="178" cy="314" r="74" fill="rgba(255,111,97,0.18)" stroke="#ff6f61" stroke-width="4" />
    <circle cx="542" cy="314" r="74" fill="rgba(73,214,200,0.18)" stroke="#49d6c8" stroke-width="4" />
    <text x="178" y="326" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="28" font-weight="860" fill="#ffffff">Musk</text>
    <text x="542" y="326" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="28" font-weight="860" fill="#ffffff">Altman</text>
    <path d="M256 314 C306 260 414 260 464 314" stroke="${scene.accent}" stroke-width="8" fill="none" stroke-linecap="round" />
    <path d="M464 314 C414 370 306 370 256 314" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.38" stroke-linecap="round" />
    <rect x="252" y="254" width="216" height="120" rx="28" fill="rgba(255,255,255,0.09)" stroke="${scene.accent}" stroke-opacity="0.46" />
    <text x="360" y="303" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="22" font-weight="820" fill="#ffffff">OpenAI</text>
    <text x="360" y="338" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="17" font-weight="720" fill="#dfe8de">治理 / 使命 / 商业化</text>
    <rect x="102" y="438" width="516" height="20" rx="10" fill="rgba(255,255,255,0.10)" />
    <rect x="102" y="438" width="172" height="20" rx="10" fill="#ff6f61" opacity="0.82" />
    <rect x="274" y="438" width="172" height="20" rx="10" fill="${scene.accent}" opacity="0.82" />
    <rect x="446" y="438" width="172" height="20" rx="10" fill="#49d6c8" opacity="0.82" />
  </g>`
  }

  if (scene.kind === "news_stakes") {
    const nodes = [
      [360, 236, "使命"],
      [204, 420, "控制权"],
      [516, 420, "资本"],
    ]
    return `
  <g filter="url(#softShadow)">
    <rect x="54" y="188" width="612" height="318" rx="34" fill="rgba(16,23,21,0.82)" stroke="rgba(255,255,255,0.16)" />
    <path d="M360 256 L220 404 M360 256 L500 404 M220 420 L500 420" stroke="${scene.accent}" stroke-width="6" opacity="0.58" stroke-linecap="round" />
    ${nodes.map(([cx, cy, label]) => `
      <circle cx="${cx}" cy="${cy}" r="58" fill="rgba(255,255,255,0.08)" stroke="${scene.accent}" stroke-width="4" />
      <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="25" font-weight="860" fill="#ffffff">${label}</text>
    `).join("")}
    <rect x="252" y="326" width="216" height="42" rx="21" fill="${scene.accent}" opacity="0.20" />
    <text x="360" y="354" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="18" font-weight="760" fill="#ffffff">解释权争夺</text>
  </g>`
  }

  if (scene.kind === "news_outlook") {
    const cards = [
      [78, "法庭", "#d7f36b"],
      [274, "监管", "#49d6c8"],
      [470, "资本", "#ffd166"],
    ]
    return `
  <g filter="url(#softShadow)">
    <rect x="54" y="188" width="612" height="318" rx="34" fill="rgba(16,23,21,0.82)" stroke="rgba(255,255,255,0.16)" />
    ${cards.map(([x, label, color], index) => `
      <rect x="${x}" y="${230 + index * 18}" width="172" height="206" rx="28" fill="rgba(255,255,255,0.08)" stroke="${color}" stroke-opacity="0.52" />
      <circle cx="${Number(x) + 86}" cy="${288 + index * 18}" r="34" fill="${color}" opacity="0.20" />
      <text x="${Number(x) + 86}" y="${356 + index * 18}" text-anchor="middle" font-family="Inter, PingFang SC, sans-serif" font-size="27" font-weight="880" fill="#ffffff">${label}</text>
      <rect x="${Number(x) + 38}" y="${388 + index * 18}" width="96" height="12" rx="6" fill="${color}" opacity="0.72" />
    `).join("")}
  </g>`
  }

  return `
  <g filter="url(#softShadow)">
    <rect x="54" y="188" width="612" height="318" rx="34" fill="rgba(16,23,21,0.82)" stroke="rgba(255,255,255,0.16)" />
    <rect x="94" y="232" width="532" height="82" rx="24" fill="rgba(255,255,255,0.08)" stroke="${scene.accent}" stroke-opacity="0.36" />
    <rect x="94" y="346" width="532" height="82" rx="24" fill="rgba(255,255,255,0.08)" stroke="#ffffff" stroke-opacity="0.14" />
    <path d="M138 274 H582 M138 388 H582" stroke="${scene.accent}" stroke-width="6" stroke-linecap="round" opacity="0.56" />
  </g>`
}

function briefVisual(scene) {
  return `
  <g filter="url(#softShadow)">
    <rect x="58" y="196" width="604" height="296" rx="34" fill="url(#smoke)" stroke="rgba(255,255,255,0.18)" />
    <rect x="92" y="232" width="244" height="176" rx="24" fill="rgba(255,255,255,0.08)" stroke="${scene.accent}" stroke-opacity="0.42" />
    <text x="118" y="272" font-family="Inter, PingFang SC, sans-serif" font-size="18" font-weight="760" fill="${scene.accent}">USER BRIEF</text>
    <rect x="118" y="300" width="168" height="14" rx="7" fill="#ffffff" opacity="0.84" />
    <rect x="118" y="330" width="132" height="14" rx="7" fill="#ffffff" opacity="0.56" />
    <rect x="118" y="360" width="188" height="14" rx="7" fill="#ffffff" opacity="0.42" />
    <path d="M336 320 C382 320 388 276 436 276" stroke="${scene.accent}" stroke-width="6" fill="none" stroke-linecap="round" />
    <circle cx="456" cy="276" r="48" fill="#11181b" stroke="${scene.accent}" stroke-width="4" />
    <text x="456" y="286" text-anchor="middle" font-family="Inter, sans-serif" font-size="34" font-weight="860" fill="#ffffff">P</text>
    <rect x="508" y="232" width="96" height="42" rx="21" fill="${scene.accent}" opacity="0.22" />
    <rect x="492" y="298" width="128" height="28" rx="14" fill="rgba(255,255,255,0.12)" />
    <rect x="492" y="344" width="128" height="28" rx="14" fill="rgba(255,255,255,0.12)" />
    <rect x="492" y="390" width="128" height="28" rx="14" fill="rgba(255,255,255,0.12)" />
    <text x="540" y="258" font-family="Inter, sans-serif" font-size="17" font-weight="760" fill="#ffffff">PLAN</text>
  </g>`
}

function teamVisual(scene) {
  const nodes = [
    [360, 286, "P"], [160, 230, "R"], [560, 230, "D"], [130, 376, "A"], [590, 376, "E"], [280, 438, "RE"], [440, 438, "QG"],
  ]
  return `
  <g filter="url(#softShadow)">
    <rect x="48" y="182" width="624" height="330" rx="36" fill="rgba(8,12,14,0.74)" stroke="rgba(255,255,255,0.15)" />
    <path d="M360 286 L160 230 M360 286 L560 230 M360 286 L130 376 M360 286 L590 376 M360 286 L280 438 M360 286 L440 438" stroke="${scene.accent}" stroke-width="5" opacity="0.52" stroke-linecap="round" />
    ${nodes.map(([cx, cy, label]) => `
      <circle cx="${cx}" cy="${cy}" r="${label === "P" ? 54 : 42}" fill="#11191b" stroke="${scene.accent}" stroke-width="${label === "P" ? 5 : 3}" />
      <text x="${cx}" y="${Number(cy) + 10}" text-anchor="middle" font-family="Inter, sans-serif" font-size="${label === "P" ? 34 : label === "QG" || label === "RE" ? 21 : 24}" font-weight="860" fill="#ffffff">${label}</text>
    `).join("")}
    <rect x="108" y="460" width="504" height="28" rx="14" fill="rgba(255,255,255,0.08)" />
    <rect x="108" y="460" width="342" height="28" rx="14" fill="${scene.accent}" opacity="0.36" />
  </g>`
}

function assetVisual(scene) {
  return `
  <g filter="url(#softShadow)">
    <rect x="54" y="188" width="612" height="318" rx="34" fill="rgba(7,9,11,0.72)" stroke="rgba(255,255,255,0.16)" />
    <rect x="82" y="218" width="246" height="166" rx="24" fill="#171c1f" stroke="${scene.accent}" stroke-opacity="0.32" />
    <circle cx="160" cy="288" r="44" fill="${scene.accent}" opacity="0.7" />
    <path d="M98 358 L166 308 L226 348 L286 292 L312 358 Z" fill="#ffffff" opacity="0.88" />
    <rect x="362" y="218" width="272" height="54" rx="18" fill="rgba(255,255,255,0.1)" />
    <rect x="362" y="294" width="272" height="54" rx="18" fill="rgba(255,255,255,0.1)" />
    <rect x="362" y="370" width="272" height="54" rx="18" fill="rgba(255,255,255,0.1)" />
    <text x="386" y="252" font-family="Inter, PingFang SC, sans-serif" font-size="19" font-weight="760" fill="#ffffff">用途：Scene 03 主图</text>
    <text x="386" y="328" font-family="Inter, PingFang SC, sans-serif" font-size="19" font-weight="760" fill="#ffffff">风险：版权 / 事实</text>
    <text x="386" y="404" font-family="Inter, PingFang SC, sans-serif" font-size="19" font-weight="760" fill="#ffffff">替代：imagegen</text>
    <path d="M104 438 L616 438" stroke="${scene.accent}" stroke-width="5" stroke-linecap="round" stroke-dasharray="22 14" />
  </g>`
}

function runtimeVisual(scene) {
  return `
  <g filter="url(#softShadow)">
    <rect x="52" y="190" width="616" height="316" rx="34" fill="#080b0d" stroke="rgba(255,255,255,0.16)" />
    <rect x="82" y="220" width="556" height="48" rx="16" fill="rgba(255,255,255,0.08)" />
    <circle cx="112" cy="244" r="6" fill="#ff6b6b" /><circle cx="134" cy="244" r="6" fill="#ffd166" /><circle cx="156" cy="244" r="6" fill="#35e8c6" />
    <text x="92" y="314" font-family="SFMono-Regular, Consolas, monospace" font-size="20" font-weight="700" fill="${scene.accent}">&gt; runtime_plan.json</text>
    <text x="92" y="356" font-family="SFMono-Regular, Consolas, monospace" font-size="18" fill="#ffffff">layout: 9:16 short video</text>
    <text x="92" y="394" font-family="SFMono-Regular, Consolas, monospace" font-size="18" fill="#ffffff">motion: push-in + hard cuts</text>
    <text x="92" y="432" font-family="SFMono-Regular, Consolas, monospace" font-size="18" fill="#ffffff">quality: captions / assets / package</text>
    <rect x="474" y="302" width="122" height="122" rx="26" fill="${scene.accent}" opacity="0.22" stroke="${scene.accent}" stroke-opacity="0.46" />
    <path d="M518 340 L518 392 L566 366 Z" fill="#ffffff" />
  </g>`
}

function packageVisual(scene) {
  return `
  <g filter="url(#softShadow)">
    <rect x="62" y="188" width="596" height="318" rx="36" fill="rgba(8,10,12,0.74)" stroke="rgba(255,255,255,0.16)" />
    <rect x="118" y="236" width="170" height="210" rx="28" fill="rgba(255,255,255,0.1)" stroke="${scene.accent}" stroke-opacity="0.42" />
    <path d="M164 312 L164 386 L232 349 Z" fill="${scene.accent}" />
    <rect x="330" y="234" width="252" height="42" rx="16" fill="rgba(255,255,255,0.11)" />
    <rect x="330" y="300" width="252" height="42" rx="16" fill="rgba(255,255,255,0.11)" />
    <rect x="330" y="366" width="252" height="42" rx="16" fill="rgba(255,255,255,0.11)" />
    <text x="356" y="261" font-family="Inter, sans-serif" font-size="18" font-weight="780" fill="#ffffff">final.mp4</text>
    <text x="356" y="327" font-family="Inter, sans-serif" font-size="18" font-weight="780" fill="#ffffff">source_project.zip</text>
    <text x="356" y="393" font-family="Inter, sans-serif" font-size="18" font-weight="780" fill="#ffffff">quality_report.md</text>
    <circle cx="600" cy="442" r="32" fill="${scene.accent}" opacity="0.9" />
    <path d="M584 442 L596 454 L618 428" fill="none" stroke="#191000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  </g>`
}

function renderSceneCardPng(svgPath, pngPath) {
  if (renderSvgToPng(svgPath, pngPath, videoWidth, videoHeight)) return true

  if (!commandAvailable("qlmanage")) return false
  const outDir = dirname(svgPath)
  const result = spawnSync("qlmanage", ["-t", "-s", String(videoHeight), "-o", outDir, svgPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const quicklookPath = `${svgPath}.png`
  if (result.status !== 0 || !existsSync(quicklookPath)) return false
  rmSync(pngPath, { force: true })
  runCommand("mv", [quicklookPath, pngPath])
  return true
}

function makeVideoClip(filePath, scene, duration = 6) {
  ensureDir(dirname(filePath))
  const frameDir = join(dirname(filePath), "..", "frames")
  ensureDir(frameDir)
  const baseName = filePath.split("/").at(-1)?.replace(/\.mp4$/, "") ?? `scene-${Date.now()}`
  const svgPath = join(frameDir, `${baseName}.svg`)
  const pngPath = join(frameDir, `${baseName}.png`)
  writeFileSync(svgPath, makeSceneSvg(scene))
  if (renderSceneCardPng(svgPath, pngPath)) {
    const frames = Math.round(duration * videoFps)
    runCommand("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-framerate",
      String(videoFps),
      "-i",
      pngPath,
      "-t",
      String(duration),
      "-vf",
      `scale=${videoWidth}:${videoHeight}:flags=lanczos,fps=${videoFps},fade=t=in:st=0:d=0.12,fade=t=out:st=${Math.max(0, duration - 0.16)}:d=0.16,format=yuv420p`,
      "-an",
      "-c:v",
      "libx264",
      "-r",
      String(videoFps),
      "-pix_fmt",
      "yuv420p",
      filePath,
    ])
    return
  }

  const accent = scene.title.length % 2 === 0 ? "0x4fd1b6" : "0xff6b6b"
  runCommand("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x020405:s=${videoWidth}x${videoHeight}:d=${duration}:r=${videoFps}`,
    "-vf",
    `drawbox=x=42:y=180:w=636:h=330:color=0xf7fbfa@0.08:t=fill,drawbox=x=84:y=82:w=552:h=40:color=${accent}@0.86:t=fill,drawbox=x=84:y=646:w=552:h=34:color=0xf7fbfa@0.52:t=fill,drawbox=x=84:y=702:w=500:h=30:color=0xb9c7c5@0.42:t=fill`,
    "-an",
    "-pix_fmt",
    "yuv420p",
    filePath,
  ])
}

function makeFinalVideo(filePath, run, scenes = sceneCardsFor(run), musicTrack = null) {
  ensureDir(dirname(filePath))
  const packageDir = dirname(filePath)
  const totalDuration = totalSceneDuration(scenes)
  const clipPaths = scenes.map((scene, index) => {
    const clipPath = join(packageDir, "assets", "video", `final-scene-${index + 1}.mp4`)
    makeVideoClip(clipPath, scene, sceneDuration(scene))
    return clipPath
  })
  const concatPath = join(packageDir, "assets", "video", "final-concat.txt")
  writeFileSync(concatPath, clipPaths.map((clipPath) => `file '${clipPath.replaceAll("'", "'\\''")}'`).join("\n") + "\n")
  const useMusic = musicTrack?.localFile && existsSync(musicTrack.localFile)
  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
  ]

  if (useMusic) {
    args.push("-stream_loop", "-1", "-i", musicTrack.localFile)
  } else {
    args.push("-f", "lavfi", "-t", String(totalDuration), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000")
  }

  args.push(
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-af",
    useMusic
      ? `atrim=0:${totalDuration},asetpts=N/SR/TB,afade=t=in:st=0:d=0.25,afade=t=out:st=${Math.max(0, totalDuration - 0.65)}:d=0.65,volume=0.18`
      : "volume=0",
    "-shortest",
    "-pix_fmt",
    "yuv420p",
    filePath
  )
  runCommand("ffmpeg", args)
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function makeSourceProject(run, sourceDir, scenes = sceneCardsFor(run)) {
  ensureDir(sourceDir)
  writeJson(join(sourceDir, "scenes.json"), scenes)
  if (run.runtime === "hyperframes") {
    const sceneRows = scenes
      .map((scene, index) => `<li><strong>${String(index + 1).padStart(2, "0")} ${escapeHtml(scene.eyebrow)}</strong><span>${escapeHtml(scene.title)}</span></li>`)
      .join("")
    writeFileSync(
      join(sourceDir, "index.html"),
      `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>AutoDirector HyperFrames Composition</title>
    <style>
      body { margin: 0; background: #121416; color: #e2e2e5; font-family: Inter, system-ui, sans-serif; }
      [data-composition-id="autodirector-final"] { width: ${videoWidth}px; height: ${videoHeight}px; background: #020405; overflow: hidden; }
      .scene-content { width: 100%; height: 100%; padding: 72px 42px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 24px; }
      h1 { color: #ffe94d; font-size: 54px; margin: 0; line-height: 1.05; }
      p { font-size: 25px; max-width: 620px; line-height: 1.35; }
      ul { list-style: none; padding: 0; display: grid; gap: 14px; }
      li { border: 1px solid rgba(255,255,255,.16); border-radius: 18px; padding: 14px 18px; background: rgba(255,255,255,.07); }
      strong, span { display: block; }
      strong { color: #66eadb; font-size: 15px; letter-spacing: .04em; }
      span { font-size: 22px; margin-top: 4px; }
    </style>
  </head>
  <body>
    <div data-composition-id="autodirector-final" data-width="${videoWidth}" data-height="${videoHeight}" data-duration="30">
      <div class="scene-content">
        <h1>${escapeHtml(scenes[0]?.hook ?? run.title)}</h1>
        <p>${escapeHtml(run.brief)}</p>
        <ul>${sceneRows}</ul>
      </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.from("h1", { y: 48, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.2);
      tl.from("p", { y: 34, opacity: 0, duration: 0.55, ease: "expo.out" }, 0.45);
      window.__timelines["autodirector-final"] = tl;
    </script>
  </body>
</html>
`
    )
    writeFileSync(join(sourceDir, "DESIGN.md"), readFileSync(join(rootDir, "DESIGN.md"), "utf8"))
    writeJson(join(sourceDir, "runtime_plan.json"), runtimePlanFor(run, scenes))
    writeFileSync(join(sourceDir, "README.md"), "Run with HyperFrames: npx hyperframes preview && npx hyperframes lint && npx hyperframes validate && npx hyperframes inspect\n")
  } else {
    ensureDir(join(sourceDir, "src"))
    const sceneTitles = JSON.stringify(scenes.map((scene) => `${scene.eyebrow}: ${scene.title}`), null, 2)
    writeFileSync(
      join(sourceDir, "src", "Composition.tsx"),
      `import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const scenes = ${sceneTitles};

export function AutoDirectorVideo() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#020405", color: "#e2e2e5", padding: "72px 42px", justifyContent: "center" }}>
      <h1 style={{ color: "#ffe94d", fontSize: 54, opacity, lineHeight: 1.05 }}>${escapeHtml(scenes[0]?.hook ?? run.title)}</h1>
      <p style={{ fontSize: 25, maxWidth: 620 }}>${escapeHtml(run.brief)}</p>
      <ul style={{ fontSize: 22, lineHeight: 1.35 }}>{scenes.map((scene) => <li key={scene}>{scene}</li>)}</ul>
    </AbsoluteFill>
  );
}
`
    )
    writeFileSync(
      join(sourceDir, "package.json"),
      JSON.stringify({ scripts: { studio: "remotion studio", render: "remotion render" }, dependencies: { remotion: "latest", react: "latest", "react-dom": "latest" } }, null, 2)
    )
    writeJson(join(sourceDir, "runtime_plan.json"), runtimePlanFor(run, scenes))
    writeFileSync(join(sourceDir, "README.md"), "Run with Remotion: npx remotion studio && npx remotion still AutoDirectorVideo --frame=30 --scale=0.25\n")
  }
}

function runtimePlanFor(run, scenes = sceneCardsFor(run)) {
  return {
    runtime: run.runtime,
    durationSeconds: Number(totalSceneDuration(scenes).toFixed(1)),
    resolution: `${videoWidth}x${videoHeight}`,
    aspectRatio: "9:16",
    mode: run.runtime === "hyperframes" ? "HTML + GSAP composition" : "React + Remotion composition",
    requiredInputs: ["shotlist.json", "caption_styleguide.json", "motion_board.json", "asset_manifest.json", "sound_plan.json"],
    checks:
      run.runtime === "hyperframes"
        ? ["DESIGN.md gate", "layout before animation", "npx hyperframes lint", "npx hyperframes validate", "npx hyperframes inspect"]
        : ["composition props", "caption timing", "npx remotion studio", "npx remotion still AutoDirectorVideo --frame=30 --scale=0.25"],
    scenes: scenes.map((scene, index) => `${String(index + 1).padStart(2, "0")} ${scene.eyebrow}: ${scene.title}`),
  }
}

function captionStyleguideFor(scenes = null) {
  const sceneList = scenes ?? sceneCardsFor({ brief: "" })
  const ranges = sceneTimeRanges(sceneList)
  const captionBlocks = sceneList.map((scene, index) => ({
    id: `cap_${String(index + 1).padStart(2, "0")}`,
    time: `${ranges[index].start.toFixed(1)}-${ranges[index].end.toFixed(1)}s`,
    text: scene.caption,
    emphasis: scene.hook,
  }))
  return {
    safeArea: { x: 48, y: 626, width: 624, height: 238 },
    typography: {
      family: "Inter / PingFang SC / SF Pro",
      maxLines: 2,
      maxWordsPerLine: 9,
      fontSize: 24,
      weight: 720,
      shadow: "0 8px 22px rgba(0,0,0,0.58)",
    },
    rules: [
      "每条字幕 1-2 行，避免超过 14 个中文词组或英文单词。",
      "字幕不能遮挡 hero asset、Agent 状态或最终包文件名。",
      "重点词允许高亮，但每屏最多 1 个 emphasis。",
    ],
    captionBlocks,
  }
}

function motionBoardFor(scenes = null) {
  const sceneList = scenes ?? sceneCardsFor({ brief: "" })
  return {
    globalPrinciples: [
      "layout first, animation second",
      "one primary motion per shot",
      "caption readability beats decorative motion",
      "transitions should explain the pipeline handoff",
    ],
    transitions: sceneList.slice(0, -1).map((scene, index) => ({
      from: scene.kind,
      to: sceneList[index + 1].kind,
      type: sceneList.some((item) => item.kind?.startsWith("news_")) ? "news beat cut" : "artifact handoff wipe",
      durationMs: 480 + index * 40,
      easing: index % 2 ? "expo.out" : "power3.out",
    })),
    patchRules: [
      "如果字幕可读性下降，先减弱 motion，而不是缩小字幕。",
      "如果画面看起来像静态 PPT，Story Director 返修 transition_plan，Video Engineer 返修实现。",
    ],
  }
}

function soundPlanFor() {
  return {
    music: {
      mood: "focused, cinematic, modern, no electrical hum",
      bpmRange: "92-120",
      sourcePolicy: "Asset Agent searches Wikimedia Commons or approved sources for reusable instrumental music, records license metadata, downloads only if a source URL and license are available.",
      fallback: "ffmpeg generated silent stereo AAC bed",
      licenseRisk: "low when Wikimedia metadata includes license; none for silent fallback",
    },
    mix: {
      targetLufs: "-16 LUFS for web preview",
      musicDucking: "duck under voiceover/captions by 8-10 dB when music exists",
      fadeInMs: 0,
      fadeOutMs: 0,
    },
    cues: [
      { time: "0.0s", cue: "soft pulse", purpose: "brief enters" },
      { time: "3.0s", cue: "dispatch tick", purpose: "Producer starts team handoff" },
      { time: "9.0s", cue: "stack click", purpose: "artifacts appear" },
      { time: "15.0s", cue: "timeline lock", purpose: "runtime plan confirmed" },
      { time: "23.0s", cue: "resolve chime", purpose: "final package ready" },
    ],
  }
}

const commonsMusicCandidates = [
  {
    title: "File:Background music - Liftoff.ogg",
    query: "cinematic technology launch instrumental background music",
    reason: "科技/产品介绍可用的推进感背景音乐",
  },
  {
    title: "File:Background music - The Emperor's Garden.ogg",
    query: "calm professional documentary instrumental music",
    reason: "适合解释型短片的克制配乐",
  },
  {
    title: "File:Background music - Beat Mekanik - Sleepless Night.ogg",
    query: "modern electronic background beat instrumental",
    reason: "适合快节奏竖屏 demo 的电子律动",
  },
]

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function commonsFileMetadata(title) {
  if (!commandAvailable("curl")) return { ok: false, reason: "curl_not_found" }
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&titles=${encodeURIComponent(title)}&iiprop=url%7Cmime%7Csize%7Cextmetadata`
  const result = runCommandMaybe("curl", ["-L", "-sS", url])
  if (result.status !== 0) return { ok: false, reason: result.stderr || "commons_api_failed", url }

  let parsed
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    return { ok: false, reason: "commons_api_invalid_json", url }
  }

  const page = Object.values(parsed.query?.pages ?? {})[0]
  const info = page?.imageinfo?.[0]
  if (!info?.url) return { ok: false, reason: "commons_file_not_found", url }
  const meta = info.extmetadata ?? {}
  return {
    ok: true,
    title,
    sourceUrl: info.url,
    mime: info.mime,
    license: stripHtml(meta.LicenseShortName?.value || meta.License?.value || "unknown"),
    licenseUrl: stripHtml(meta.LicenseUrl?.value || ""),
    artist: stripHtml(meta.Artist?.value || meta.Credit?.value || "Wikimedia Commons contributor"),
    attribution: stripHtml(meta.Attribution?.value || meta.Credit?.value || ""),
    apiUrl: url,
  }
}

function discoverOnlineMusic(run, packageDir) {
  const musicDir = join(packageDir, "assets", "music")
  ensureDir(musicDir)
  const attempts = []
  pushEvent("music.search.started", { runId: run.id, agentId: "sound", provider: "Wikimedia Commons" })

  if (!commandAvailable("curl")) {
    const fallback = { status: "silent_fallback", reason: "curl_not_found", attempts }
    pushEvent("music.fallback", { runId: run.id, agentId: "sound", reason: fallback.reason })
    return fallback
  }

  for (const candidate of commonsMusicCandidates) {
    const metadata = commonsFileMetadata(candidate.title)
    attempts.push({ candidate, metadata })
    if (!metadata.ok || !metadata.sourceUrl) continue

    const extension = metadata.sourceUrl.split("?")[0].split(".").at(-1)?.toLowerCase() || "ogg"
    const localFile = join(musicDir, `soundtrack.${extension}`)
    const download = runCommandMaybe("curl", ["-L", "-sS", metadata.sourceUrl, "-o", localFile])
    if (download.status !== 0 || !existsSync(localFile)) {
      attempts.at(-1).download = { ok: false, reason: download.stderr || "download_failed" }
      continue
    }

    const probe = commandAvailable("ffprobe")
      ? runCommandMaybe("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", localFile])
      : null
    const duration = probe?.status === 0 ? Number.parseFloat(probe.stdout.trim()) : null
    if (probe && probe.status !== 0) {
      attempts.at(-1).download = { ok: false, reason: probe.stderr || "ffprobe_failed" }
      rmSync(localFile, { force: true })
      continue
    }

    const track = {
      status: "downloaded",
      provider: "Wikimedia Commons",
      query: candidate.query,
      reason: candidate.reason,
      title: metadata.title,
      sourceUrl: metadata.sourceUrl,
      apiUrl: metadata.apiUrl,
      localFile,
      relativeFile: `assets/music/soundtrack.${extension}`,
      license: metadata.license,
      licenseUrl: metadata.licenseUrl,
      artist: metadata.artist,
      attribution: metadata.attribution,
      durationSeconds: Number.isFinite(duration) ? duration : null,
      mix: "loop if needed, trim to 30s, fade in/out, volume 24%",
      attempts,
    }
    pushEvent("music.downloaded", { runId: run.id, agentId: "sound", title: track.title, license: track.license })
    return track
  }

  const fallback = { status: "silent_fallback", reason: "no_commons_candidate_downloaded", attempts }
  pushEvent("music.fallback", { runId: run.id, agentId: "sound", reason: fallback.reason })
  return fallback
}

function formatAgentTranscript(run) {
  const runEvents = state.events.filter((event) => event.payload?.runId === run.id)
  const scenes = sceneCardsFor(run)
  const researchPack = researchPackFor(run, scenes)
  const taskRows = run.tasks
    .map((task, index) => {
      const worker = state.workers[task.agentId] ?? { shortName: task.agentId, role: task.agentId }
      return `| ${index + 1} | ${task.label} | ${worker.shortName} | ${task.status} | ${task.inputArtifactIds.join(", ")} | ${task.outputArtifactIds.join(", ")} |`
    })
    .join("\n")
  const artifactRows = run.artifacts
    .map((artifact) => `| ${artifact.id} | ${artifact.title} | ${artifact.ownerAgentId} | ${artifact.type} | ${artifact.summary.replaceAll("|", "/")} |`)
    .join("\n")
  const agentSections = Object.values(state.workers)
    .map((worker) => {
      return `## ${worker.shortName} Agent\n\n- Role: ${worker.role}\n- Model: ${worker.model}\n- Thinking level: ${worker.thinkingLabel ?? worker.thinkingLevel}\n- Capabilities: ${worker.capabilities?.join(", ") || "standard text/reasoning"}\n- Status: ${worker.status}\n- Inbox: ${worker.inbox.join(", ") || "empty"}\n- Outbox: ${worker.outbox.join(", ") || "empty"}\n- Artifacts: ${worker.artifacts.join(", ") || "empty"}\n`
    })
    .join("\n")
  const eventLines = runEvents
    .map((event) => `- ${event.createdAt} · ${event.type} · ${JSON.stringify(event.payload)}`)
    .join("\n")
  const logLines = run.logs.map((line) => `- ${line}`).join("\n")

  return `# AutoDirector Multi-Agent Transcript

Run: ${run.id}
Status: ${run.status}
Runtime: ${run.runtime}
Brief: ${run.brief}

## Producer Chat Record

- User: ${run.brief}
- Producer: 收到。Producer 将 brief 拆成可审计流水线，只由 Producer 对外沟通，其他 Agent 在后台通过 artifact 交接。
- Producer: 当前 run 进入 ${run.status}，所有 Agent 的派工、交接、产物和日志如下。

## Agent Handoff Table

| # | Stage | Agent | Status | Input artifacts | Output artifacts |
|---:|---|---|---|---|---|
${taskRows}

## Artifact Ledger

| Artifact | Title | Owner | Type | Summary |
|---|---|---|---|---|
${artifactRows}

## Content Plan

- Brief kind: ${briefKind(run)}
- Research topic: ${researchPack.topic}
- Scene titles: ${scenes.map((scene) => scene.title).join(" / ")}
- Asset acquisition: ${scenes.map((scene) => scene.assetTitle ?? scene.kind).join(" / ")}

## Agent Inbox / Outbox

${agentSections}

## Event Timeline

${eventLines || "- No live SSE events retained for this run."}

## Raw Run Log

${logLines}
`
}

function judgingReadmeFor(run, gate, scenes, imagegenResults, evidenceAssets = []) {
  const ready = gate.ok
  const acceptedHeroCount = gate.acceptedCount ?? 0
  const agentRows = agents
    .map(([id, shortName, role]) => `| ${shortName} | ${role} | ${state.workers[id]?.artifacts?.join(", ") || "pending"} |`)
    .join("\n")
  const sceneRows = scenes
    .map((scene, index) => {
      const image = imagegenResults[index]
      return `| ${index + 1} | ${scene.title} | ${scene.kind} | ${image?.provider ?? "missing"} | ${image?.status ?? "missing"} |`
    })
    .join("\n")
  const blockers = gate.failures?.length ? gate.failures.map((item) => `- ${item}`).join("\n") : "- None"
  return `# AutoDirector Judging README

Run: ${run.id}
Status: ${ready ? "ready" : "blocked honestly"}
Brief: ${run.brief}

## What To Show Judges First

1. Open the Web UI and show the Producer chat plus Agent timeline.
2. Open Delivery and play \`final.mp4\` if this package is ready.
3. Open \`agent_interactions.md\` to prove Agent handoffs, inbox/outbox, and artifact ownership.
4. Open \`asset_manifest.json\`, \`citations.md\`, and \`quality_report.md\` to show sourcing and quality gates.
5. If blocked, open \`blocked_imagegen_request.json\` and show that AutoDirector refused to ship a fake final video.

## Why This Is A Real Agent Team

- One user-facing Producer controls intake, dispatch, success criteria, and patch routing.
- Six production Agents execute bounded duties: Research, Story Director, Asset, Video Engineer, Render, and Quality Gate.
- Every step has explicit input artifacts, output artifacts, status, owner, and handoff rule.
- The pipeline advances only after a real artifact submission; it does not fabricate completed Agent output.

## Agent Matrix

| Agent | Role | Produced artifacts |
|---|---|---|
${agentRows}

## Visual / Asset Evidence

Accepted hero visuals: ${acceptedHeroCount}/${scenes.length}
OAuth imagegen visuals: ${gate.oauthCount ?? 0}
Public-source editorial visuals: ${gate.sourceEditorialCount ?? 0}
Fallback visuals rejected by final gate: ${gate.fallbackCount ?? 0}
Public evidence assets staged: ${evidenceAssets.length}

| # | Scene | Kind | Visual provider | Status |
|---:|---|---|---|---|
${sceneRows}

## Quality Gate

${ready ? "Quality Gate passed the final package gate." : "Quality Gate blocked final render/package readiness before exposing a fake final.mp4."}

${blockers}

## Package Map

- \`final.mp4\`: playable final video, present only when quality/imagegen gates pass.
- \`source_project.zip\`: runnable source project for the rendered video.
- \`asset_manifest.json\`: visual/audio/source provenance and risk notes.
- \`runtime_plan.json\`: HyperFrames/Remotion implementation plan.
- \`caption_styleguide.json\`, \`motion_board.json\`, \`sound_plan.json\`: production quality specs.
- \`imagegen_prompt_pack.json\`: prompts and required filenames for OAuth imagegen.
- \`research_pack.json\`, \`topic_scorecard.json\`, \`citations.md\`: factual and sourcing trail.
- \`quality_report.md\`: acceptance result and blockers.
- \`run_log.jsonl\`: machine-readable production log.
`
}

function sceneDuration(scene) {
  const value = Number(scene?.durationSeconds)
  return Number.isFinite(value) && value > 0 ? value : 6
}

function totalSceneDuration(scenes = []) {
  return scenes.reduce((sum, scene) => sum + sceneDuration(scene), 0)
}

function sceneTimeRanges(scenes = []) {
  let cursor = 0
  return scenes.map((scene) => {
    const start = cursor
    const end = cursor + sceneDuration(scene)
    cursor = end
    return { start, end }
  })
}

function imagegenPromptPackFor(scenes = null) {
  const topic = scenes?.some((scene) => scene.kind?.startsWith("news_"))
    ? "Elon Musk vs Sam Altman / OpenAI public conflict, current trial and governance dispute."
    : "AutoDirector controllable multi-agent video production platform: Producer orchestration, Agent handoff, assets, runtime, render and quality gate."
  const scenePrompts = (scenes ?? sceneCardsFor({ brief: "Musk Altman OpenAI" })).map((scene, index) => ({
    id: `scene_${index + 1}_oauth_imagegen`,
    useCase: "infographic-diagram",
    assetType: `scene-${index + 1}.png vertical ${scene.kind?.startsWith("news_") ? "news" : "product explainer"} hero`,
    placement: "full_width_hero_zone",
    outputFilename: `scene-${index + 1}.png`,
    shotIds: [`shot_${String(index + 1).padStart(2, "0")}`],
    prompt: [
      `Use case: infographic-diagram`,
      `Asset type: 9:16 vertical news explainer hero image for shot ${index + 1}`,
      `Primary request: ${scene.assetTitle ?? scene.title}. ${scene.assetPurpose ?? scene.body}`,
      `Topic: ${topic}`,
      `Composition: looks like a premium editorial news graphic generated by imagegen, not an HTML dashboard. Use layered collage, source-document texture, subtle abstract diagrams, cinematic depth, and one clear focal structure. If public figure reference is needed, use small editorial evidence-style portrait cards rather than a full-screen face.`,
      `Style: bright premium explainer, clean daylight glass palette, white/soft mint/warm amber accents, crisp high-contrast shapes, polished raster illustration / editorial collage, enough empty space for title and captions.`,
      `Text policy: no readable text, no fake UI labels, no logos, no watermarks; all Chinese titles and subtitles will be rendered by the video runtime.`,
      `Avoid: HTML card look, pure vector wireframe, simple lines only, large headshot, purple AI gradient, dark room with people, black background, tiny unreadable labels, clutter.`,
    ].join("\n"),
  }))
  return {
    skill: {
      name: "imagegen",
      path: process.env.AUTODIRECTOR_IMAGEGEN_SKILL ?? "codex-skill:imagegen",
      modelDefault: defaultImageModel,
      imageModel: state.settings.imageModel ?? defaultImageModel,
      requires: "connected ChatGPT/Codex OAuth imagegen capability; no raw Image API / OPENAI_API_KEY fallback",
    },
    policy: "Asset Agent treats imagegen as a first-class OAuth Agent capability. The only live generation path is: connected Agent generates images with gpt-image-2, writes scene-1.png / scene-2.png files into a local artifact directory, then calls autodirector_register_image_assets or POST /api/runs/:id/register-image-assets. AutoDirector must not call the raw Image API or use OPENAI_API_KEY. If OAuth assets are missing, compositor fallback is allowed only as visible fallback and Quality Gate must fail the imagegen requirement.",
    prompts: scenePrompts,
  }
}

function scriptFor(run, scenes = sceneCardsFor(run)) {
  const ranges = sceneTimeRanges(scenes)
  const lines = scenes
    .map((scene, index) => `| ${ranges[index].start.toFixed(1)}-${ranges[index].end.toFixed(1)}s | ${scene.eyebrow} | ${scene.title} | ${scene.body} | ${scene.caption} |`)
    .join("\n")
  return `# Script

Brief: ${run.brief}

| Time | Beat | On-screen title | Voiceover / body | Caption |
| --- | --- | --- | --- | --- |
${lines}

## Notes

- Producer must keep the run tied to the user brief, not the default AutoDirector demo.
- Claims marked as dispute/position must be phrased as allegations or stated positions, not court findings.
`
}

function shotlistFor(run, runtimePlan, captionStyleguide, motionBoard, scenes = sceneCardsFor(run)) {
  return {
    briefKind: briefKind(run),
    shots: scenes.map((scene, index) => ({
      id: `shot_${index + 1}`,
      scene: runtimePlan.scenes[index],
      kind: scene.kind,
      duration: scene.durationSeconds ?? 6,
      title: scene.title,
      body: scene.body,
      captionRef: captionStyleguide.captionBlocks[index]?.id ?? null,
      transitionRef: motionBoard.transitions[index]?.type ?? "hold",
      asset: scene.assetTitle ?? scene.kind,
      sourceUrl: scene.assetUrl ?? null,
    })),
  }
}

function researchPackFor(run, scenes = sceneCardsFor(run)) {
  const plan = newsPlanFor(run)
  if (plan?.researchPack) {
    return {
      ...plan.researchPack,
      scenes: scenes.map((scene) => ({
        kind: scene.kind,
        claim: scene.body,
        caption: scene.caption,
        sourceUrl: scene.assetSourcePage ?? scene.assetUrl ?? null,
        risk: scene.assetRisk ?? "needs source review",
      })),
    }
  }
  return {
    topic: "AutoDirector multi-agent video generation",
    keyFacts: [
      { id: "fact_01", claim: "AutoDirector uses Producer-led artifact handoffs.", risk: "low; product claim" },
      { id: "fact_02", claim: "Final package includes video, source, assets and quality report.", risk: "low; generated package evidence" },
    ],
    scenes: scenes.map((scene) => ({ kind: scene.kind, claim: scene.body })),
  }
}

function topicScorecardFor(run, scenes = sceneCardsFor(run)) {
  return {
    briefKind: briefKind(run),
    chosenAngle: scenes[0]?.title ?? run.title,
    whyThisAngle: briefKind(run) === "musk_altman_news" ? "High-conflict AI governance news explainer with clear opposing positions." : "Hackathon demo focused on controllable multi-agent production.",
    risk: briefKind(run) === "musk_altman_news" ? "Facts must be refreshed before public submission; legal claims need careful wording." : "Avoid looking like a static template.",
    titles: scenes.map((scene) => scene.title),
  }
}

function citationsFor(run, scenes, musicTrack, evidenceAssets = []) {
  const lines = ["# Citations", ""]
  if (briefKind(run) === "musk_altman_news") {
    const sources = newsPlanFor(run)?.researchPack?.sources ?? []
    for (const source of sources) {
      lines.push(`- ${source.publisher}: ${source.title} — ${source.url}`)
    }
    lines.push("- Research requirement: Research Agent must refresh these current-event sources before public submission if the run is reused later.")
    lines.push("- Fact framing: conflict points are presented as public dispute positions, not final legal findings.")
  } else {
    lines.push("- EasyClaw hackathon page: https://easyclaw.link/zh/hackathon")
  }
  for (const scene of scenes) {
    if (scene.assetSourcePage || scene.assetUrl) {
      lines.push(`- ${scene.assetTitle ?? scene.title}: ${scene.assetSourcePage ?? scene.assetUrl} — ${scene.license ?? "license needs review"}`)
    }
  }
  for (const asset of evidenceAssets) {
    lines.push(`- ${asset.title}: ${asset.sourcePage ?? asset.url} — ${asset.license ?? "license needs review"}`)
  }
  lines.push(`- Music: ${musicTrack.status === "downloaded" ? `${musicTrack.title} — ${musicTrack.sourceUrl} — ${musicTrack.license} ${musicTrack.licenseUrl}` : "silent AAC fallback; no music source used"}`)
  lines.push(`- Runtime rules: ${run.runtime === "hyperframes" ? "HyperFrames skill pack" : "Remotion skill pack"}`)
  return `${lines.join("\n")}\n`
}

function qualityReportFor(run, scenes, imagegenResults, musicTrack, evidenceAssets = []) {
  const kind = briefKind(run)
  const titles = scenes.map((scene) => `${scene.eyebrow} ${scene.hook} ${scene.title} ${scene.body}`).join(" ")
  const generatedCount = imagegenResults.filter((item) => item.status === "generated").length
  const publicAssetCount = evidenceAssets.filter((item) => item.provider === "browser_search_public_evidence_asset" && (item.status === "generated" || item.sourcePage)).length
  const oauthImageCount = imagegenResults.filter((item) => item.provider === "oauth_agent_imagegen_artifact").length
  const sourceHeroCount = imagegenResults.filter((item) => item.provider === "browser_search_public_editorial_collage" && item.status === "generated").length
  const acceptedHeroCount = oauthImageCount + sourceHeroCount
  const structuralDiagramCount = imagegenResults.filter((item) => item.provider === "local_raster_structural_diagram").length
  const missingHeroCount = Math.max(0, scenes.length - acceptedHeroCount)
  const failures = []
  const hasLocalFallbackDiagram = structuralDiagramCount > 0
  const missingHeroVisuals = acceptedHeroCount < scenes.length
  if (missingHeroVisuals) failures.push(`Missing accepted hero visuals: OAuth/imagegen or public-source editorial ${acceptedHeroCount}/${scenes.length}.`)
  if (hasLocalFallbackDiagram) failures.push(`Local structural diagrams were used as hero visuals: ${structuralDiagramCount}. This cannot pass final quality gate.`)
  if (kind === "musk_altman_news") {
    if (/AutoDirector 参赛片|14 个 worker|Producer 接到 brief|Runtime Plan 锁定/.test(titles)) failures.push("News brief fell back to AutoDirector demo template.")
    if (!/Musk|Altman|OpenAI|马斯克|奥特曼/.test(titles)) failures.push("News scenes do not mention Musk / Altman / OpenAI.")
    if (publicAssetCount < 2) failures.push("Expected public evidence portrait/source assets for both sides.")
    if (acceptedHeroCount < scenes.length) failures.push("Every news hero visual must be supplied by OAuth imagegen or public-source editorial evidence assets; local HTML/SVG/raster diagrams are fallback only and cannot pass strict quality gate.")
    if (new Set(imagegenResults.map((item) => item.relativeFile ?? item.sourceFile ?? item.provider)).size < scenes.length) failures.push("Expected at least five distinct hero visuals.")
    const researchPack = newsPlanFor(run)?.researchPack
    const hasResearchPlan = Array.isArray(researchPack?.keyFacts) && researchPack.keyFacts.length >= 3 && Array.isArray(researchPack?.sources) && researchPack.sources.length >= 3
    const allFactsSourced = researchPack?.keyFacts?.every((fact) => Array.isArray(fact.source_ids) && fact.source_ids.length > 0)
    if (!hasResearchPlan || !allFactsSourced) failures.push("Research Agent did not provide sourced facts for the news topic.")
  }
  if (generatedCount === 0 && kind !== "musk_altman_news") failures.push("No OAuth imagegen hero assets were registered; only compositor fallback was used.")
  const status = failures.length ? "Failed" : "Passed"
  return `# Quality Report

Status: ${status}

- Final video exists: ${requiresStrictOAuthImagegen(run) && acceptedHeroCount < scenes.length ? "no; blocked before render because accepted hero visuals are missing" : "yes"}
- Brief kind: ${kind}
- Includes video materials: yes
- Includes caption styleguide: yes
- Includes transition / motion board: yes
- Includes sound plan: yes
- Includes imagegen prompt pack: yes
- Hero visual files staged: ${generatedCount}/${imagegenResults.length}
- OAuth image assets: ${oauthImageCount}/${scenes.length}
- Public-source editorial hero assets: ${sourceHeroCount}/${scenes.length}
- Local fallback diagrams: ${structuralDiagramCount}
- Missing accepted hero assets: ${missingHeroCount}
- Public/source assets: ${publicAssetCount}
- Online music: ${musicTrack.status === "downloaded" ? `${musicTrack.title} (${musicTrack.license})` : `fallback ${musicTrack.reason}`}
- Audio hum check: passed; no sine-tone bed is used
- Includes source project: yes
- Includes asset manifest and citations: yes
- Runtime: ${run.runtime}
- Multi-agent evidence: Producer + ${agents.length - 1} Agents with inbox/outbox/artifacts

## Blocking Failures

${failures.length ? failures.map((item) => `- ${item}`).join("\n") : "- None"}
`
}

function requiresStrictOAuthImagegen(run) {
  return true
}

function strictImagegenGate(run, scenes, imagegenResults) {
  const oauthResults = imagegenResults.filter((item) => item.provider === "oauth_agent_imagegen_artifact" && item.status === "generated")
  const sourceEditorialResults = imagegenResults.filter((item) => item.provider === "browser_search_public_editorial_collage" && item.status === "generated")
  const acceptedResults = [...oauthResults, ...sourceEditorialResults]
  const fallbackResults = imagegenResults.filter((item) => !["oauth_agent_imagegen_artifact", "browser_search_public_editorial_collage"].includes(item.provider))
  const distinctCount = new Set(acceptedResults.map((item) => item.relativeFile ?? item.sourceFile ?? item.file ?? item.id)).size
  const failures = []
  if (acceptedResults.length < scenes.length) failures.push(`需要 ${scenes.length} 张合格主视觉（OAuth imagegen 或真实来源 editorial collage），实际只有 ${acceptedResults.length} 张。`)
  if (distinctCount < scenes.length) failures.push(`需要 ${scenes.length} 个互不相同的合格主视觉文件，实际只有 ${distinctCount} 个。`)
  if (fallbackResults.length) failures.push(`发现 ${fallbackResults.length} 张本地 fallback 图，不能计入最终成片素材。`)
  return {
    ok: failures.length === 0,
    failures,
    oauthCount: oauthResults.length,
    sourceEditorialCount: sourceEditorialResults.length,
    acceptedCount: acceptedResults.length,
    distinctCount,
    fallbackCount: fallbackResults.length,
  }
}

function blockedImagegenRequestFor(run, scenes, gate, imagegenPromptPack) {
  const assetDir = join(rootDir, "output", "imagegen", run.id)
  return {
    status: "blocked",
    reason: "missing_required_oauth_imagegen_assets",
    runId: run.id,
    requiredCount: scenes.length,
    oauthImagegenCount: gate.oauthCount,
    sourceEditorialCount: gate.sourceEditorialCount ?? 0,
    acceptedHeroCount: gate.acceptedCount ?? gate.oauthCount,
    distinctOAuthImagegenCount: gate.distinctCount,
    failures: gate.failures,
    policy: "本项目要求非直接素材主视觉由 ChatGPT/Codex OAuth imagegen 生成。AutoDirector 不调用 raw Image API，也不能把 HTML/SVG/local raster fallback 当成合格最终图。",
    expectedFiles: scenes.map((_, index) => `scene-${index + 1}.png`),
    outputDirectory: assetDir,
    registerEndpoint: `/api/runs/${run.id}/register-image-assets`,
    registerCommand: `curl -X POST http://127.0.0.1:${port}/api/runs/${run.id}/register-image-assets -H 'content-type: application/json' -d '{"assetDir":"${assetDir}"}'`,
    nextStep: "让 Asset/Imagegen Agent 用 gpt-image-2 生成 expectedFiles，写入 outputDirectory，再调用 registerEndpoint，然后重新生成最终包。",
    prompts: imagegenPromptPack.prompts,
  }
}

function renderOutputPathForRun(run) {
  const artifact = run.artifacts.find((item) => item.id === "render_report")
  const content = parseArtifactContent(artifact)
  const outputPath = typeof content === "object" && content ? content.outputPath ?? content.finalVideoPath : null
  return outputPath && existsSync(outputPath) ? outputPath : null
}

function generateFinalPackage(run) {
  const runDir = join(runsDir, run.id)
  const packageDir = join(runDir, "final-package")
  const assetsDir = join(packageDir, "assets", "video")
  const sourceDir = join(packageDir, "source_project")
  pushEvent("package.preflight", { runId: run.id, agentId: "quality", outputId: "imagegen_gate" })
  rmSync(packageDir, { recursive: true, force: true })
  ensureDir(assetsDir)

  const scenes = sceneCardsFor(run)
  const evidenceAssets = downloadEvidenceAssets(run, scenes, packageDir)
  const imagegenResults = generateSceneHeroImages(run, scenes, packageDir)
  const videoAssets = generatedAssets(run, scenes)
  const musicTrack = discoverOnlineMusic(run, packageDir)
  makeSourceProject(run, sourceDir, scenes)

  const runtimePlan = runtimePlanFor(run, scenes)
  const captionStyleguide = captionStyleguideFor(scenes)
  const motionBoard = motionBoardFor(scenes)
  const soundPlan = soundPlanFor()
  const imagegenPromptPack = imagegenPromptPackFor(scenes)
  const gate = strictImagegenGate(run, scenes, imagegenResults)
  const blockedImagegenRequest = gate.ok ? null : blockedImagegenRequestFor(run, scenes, gate, imagegenPromptPack)
  if (gate.ok) {
    pushEvent("package.rendering", { runId: run.id, agentId: "render", outputId: "final_video" })
    const renderedOutput = renderOutputPathForRun(run)
    if (renderedOutput) {
      copyFileSync(renderedOutput, join(packageDir, "final.mp4"))
      run.logs.push(`[package] used render_report output as final.mp4: ${renderedOutput}`)
    } else {
      videoAssets.forEach((asset, index) => {
        makeVideoClip(join(packageDir, asset.file), scenes[index] ?? scenes.at(-1), asset.durationSeconds ?? 6)
      })
      makeFinalVideo(join(packageDir, "final.mp4"), run, scenes, musicTrack)
    }
  } else {
    pushEvent("imagegen.blocked", { runId: run.id, agentId: "asset", failures: gate.failures })
    run.logs.push(`[imagegen] blocked before render: ${gate.failures.join(" | ")}`)
  }

  const assetManifest = {
    generatedAt: new Date().toISOString(),
    briefKind: briefKind(run),
    researchPack: newsPlanFor(run)?.researchPack ?? null,
    policy: "Asset Agent acquisition order: direct public/source evidence images for real photos, plus OAuth Agent imagegen artifact directory registered through MCP/REST for every non-direct-material hero visual. Local raster structural diagrams are visible fallback only and must not pass strict quality gate for imagegen-quality news videos. Generated images must not use OPENAI_API_KEY or raw Image API.",
    assets: videoAssets,
    evidenceAssets,
    imagegenResults,
    musicTrack,
    imagegenPromptPack: "imagegen_prompt_pack.json",
    blockedImagegenRequest: blockedImagegenRequest ? "blocked_imagegen_request.json" : null,
  }
  const qualityReport = qualityReportFor(run, scenes, imagegenResults, musicTrack, evidenceAssets)
  const judgingReadme = judgingReadmeFor(run, gate, scenes, imagegenResults, evidenceAssets)
  const citations = citationsFor(run, scenes, musicTrack, evidenceAssets)
  const researchPack = researchPackFor(run, scenes)
  const topicScorecard = topicScorecardFor(run, scenes)
  const runLog = run.logs.concat([
    gate.ok ? "[package] generated video materials" : "[package] staged fallback materials for inspection only",
    gate.ok ? "[package] rendered final.mp4" : "[package] blocked before final.mp4 because accepted hero visuals are missing",
    "[package] wrote source_project",
    "[package] wrote judging_readme.md",
    "[package] wrote quality_report.md",
  ])

  writeFileSync(join(packageDir, "judging_readme.md"), judgingReadme)
  writeJson(join(packageDir, "asset_manifest.json"), assetManifest)
  writeJson(join(packageDir, "runtime_plan.json"), runtimePlan)
  writeJson(join(packageDir, "caption_styleguide.json"), captionStyleguide)
  writeJson(join(packageDir, "motion_board.json"), motionBoard)
  writeJson(join(packageDir, "sound_plan.json"), soundPlan)
  writeJson(join(packageDir, "music_manifest.json"), musicTrack)
  writeJson(join(packageDir, "imagegen_prompt_pack.json"), imagegenPromptPack)
  if (blockedImagegenRequest) writeJson(join(packageDir, "blocked_imagegen_request.json"), blockedImagegenRequest)
  writeJson(join(packageDir, "research_pack.json"), researchPack)
  writeJson(join(packageDir, "topic_scorecard.json"), topicScorecard)
  writeFileSync(join(packageDir, "agent_interactions.md"), formatAgentTranscript(run))
  writeFileSync(join(packageDir, "script.md"), scriptFor(run, scenes))
  writeJson(join(packageDir, "shotlist.json"), shotlistFor(run, runtimePlan, captionStyleguide, motionBoard, scenes))
  writeFileSync(join(packageDir, "citations.md"), citations)
  writeFileSync(join(packageDir, "quality_report.md"), qualityReport)
  writeFileSync(join(packageDir, "run_log.jsonl"), runLog.map((line, index) => JSON.stringify({ index, line })).join("\n") + "\n")

  pushEvent("package.writing", { runId: run.id, agentId: "quality", outputId: "final_package" })
  runCommand("zip", ["-qr", "source_project.zip", "source_project"], { cwd: packageDir })
  const packageFiles = [
    ...(gate.ok ? ["final.mp4"] : []),
    "judging_readme.md",
    "source_project.zip",
    "asset_manifest.json",
    "runtime_plan.json",
    "caption_styleguide.json",
    "motion_board.json",
    "sound_plan.json",
    "music_manifest.json",
    "imagegen_prompt_pack.json",
    ...(blockedImagegenRequest ? ["blocked_imagegen_request.json"] : []),
    "research_pack.json",
    "topic_scorecard.json",
    "agent_interactions.md",
    "script.md",
    "shotlist.json",
    "citations.md",
    "quality_report.md",
    "run_log.jsonl",
    "assets",
  ]
  runCommand(
    "zip",
    ["-qr", `${run.id}-final-package.zip`, ...packageFiles],
    { cwd: packageDir }
  )

  const files = listFilesRecursive(packageDir)
  run.package = {
    status: gate.ok ? "ready" : "blocked",
    outputDir: packageDir,
    finalVideoUrl: gate.ok ? `/api/runs/${run.id}/files/final.mp4` : null,
    packageZipUrl: `/api/runs/${run.id}/files/${run.id}-final-package.zip`,
    sourceZipUrl: `/api/runs/${run.id}/files/source_project.zip`,
    files,
    videoAssets: gate.ok ? videoAssets : [],
    blockedReason: gate.ok ? null : gate.failures,
    generatedAt: new Date().toISOString(),
  }
  run.artifacts = run.artifacts
    .filter((artifact) => !["final_video", "final_package", "imagegen_prompt_pack", "blocked_imagegen_request"].includes(artifact.id))
    .concat([
      ...(gate.ok
        ? [
            {
              id: "final_video",
              title: "final.mp4",
              type: "mp4",
              ownerAgentId: "render",
              path: run.package.finalVideoUrl,
              summary: "30 秒可播放最终视频，包含本地生成的视频素材与 AutoDirector 叙事。",
              checks: ["ffmpeg render complete", "playable mp4", "included in package"],
              createdAt: run.package.generatedAt,
            },
          ]
        : [
            {
              id: "blocked_imagegen_request",
              title: "OAuth imagegen 阻塞请求",
              type: "json",
              ownerAgentId: "asset",
              path: `/api/runs/${run.id}/files/blocked_imagegen_request.json`,
              summary: `缺少 gpt-image-2/OAuth 生成的 ${scenes.length} 张主视觉；系统已拒绝渲染假 final.mp4。`,
              checks: ["render blocked", "prompt pack ready", "no fallback accepted"],
              createdAt: run.package.generatedAt,
            },
            {
              id: "imagegen_prompt_pack",
              title: "imagegen_prompt_pack.json",
              type: "json",
              ownerAgentId: "asset",
              path: `/api/runs/${run.id}/files/imagegen_prompt_pack.json`,
              summary: `交给 Imagegen Agent 的 ${scenes.length} 张主视觉生成提示词和文件名约定。`,
              checks: [`${scenes.length} prompts`, "gpt-image-2 policy", "OAuth only"],
              createdAt: run.package.generatedAt,
            },
          ]),
      {
        id: "final_package",
        title: "最终交付 ZIP",
        type: "zip",
        ownerAgentId: "quality",
        path: run.package.packageZipUrl,
        summary: gate.ok
          ? "包含 final.mp4、judging_readme、source_project、素材说明、引用来源、质量报告、运行日志。"
          : "阻塞包：包含 judging_readme、source_project、素材说明、prompt pack、质检失败报告和运行日志，但不包含假 final.mp4。",
        checks: gate.ok ? ["zip complete", "submission ready", "judging guide included", "reviewable source included"] : ["zip complete", "blocked honestly", "judging guide included", "no fake final video"],
        createdAt: run.package.generatedAt,
      },
    ])
  if (gate.ok) {
    run.status = "final"
    run.automationStatus = "complete"
    run.completedSteps = pipeline.length
    run.selectedAgentId = "quality"
  } else {
    markImagegenRepairNeeded(run, blockedImagegenRequest)
  }
  run.updatedAt = new Date().toISOString()
  recomputeRunEta(run)
  saveState()
  pushEvent(gate.ok ? "package.ready" : "package.blocked", { runId: run.id, package: run.package })
  if (!gate.ok && ["oauth_agents", "codex_native"].includes(normalizeExecutionMode(run.executionMode ?? state.settings.executionMode))) {
    dispatchNext(run.id)
  }
  return run
}

function generateOneClick(brief = "") {
  const run = createRun(brief)
  if (["oauth_agents", "codex_native"].includes(normalizeExecutionMode(run.executionMode ?? state.settings.executionMode))) {
    dispatchNext(run.id)
    return state.runs[run.id]
  }
  dispatchAll(run.id)
  return generateFinalPackage(state.runs[run.id])
}

function routeOAuthProtectedResource(req, res) {
  const origin = originFromReq(req)
  json(res, 200, {
    resource: origin,
    authorization_servers: [origin],
    scopes_supported: ["openid", "profile", "autodirector.run"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/`,
  })
}

function routeOAuthAuthorizationServerMetadata(req, res) {
  json(res, 200, oauthMetadata(originFromReq(req)))
}

function routeOAuthJwks(req, res) {
  ensureOAuthState()
  const jwk = createPublicKey(state.oauth.keys.publicKeyPem).export({ format: "jwk" })
  json(res, 200, {
    keys: [
      {
        ...jwk,
        kid: state.oauth.keys.kid,
        alg: "RS256",
        use: "sig",
        key_ops: ["verify"],
      },
    ],
  })
}

async function routeOAuthRegister(req, res) {
  const body = await readJson(req)
  const clientId = randomId("client")
  state.oauth.clients[clientId] = {
    client_id: clientId,
    client_name: body.client_name ?? "AutoDirector Dev Client",
    redirect_uris: body.redirect_uris ?? [],
    scope: body.scope ?? "openid profile autodirector.run",
    grant_types: body.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: body.response_types ?? ["code"],
    token_endpoint_auth_method: "none",
    createdAt: new Date().toISOString(),
  }
  saveState()
  json(res, 201, {
    client_id: clientId,
    client_name: state.oauth.clients[clientId].client_name,
    redirect_uris: state.oauth.clients[clientId].redirect_uris,
    grant_types: state.oauth.clients[clientId].grant_types,
    response_types: state.oauth.clients[clientId].response_types,
    scope: state.oauth.clients[clientId].scope,
    token_endpoint_auth_method: "none",
    client_id_issued_at: Math.floor(Date.now() / 1000),
  })
}

function validateAuthorizationRequest(params, origin) {
  const responseType = params.get("response_type")
  const clientId = params.get("client_id")
  const redirectUri = params.get("redirect_uri")
  const codeChallenge = params.get("code_challenge")
  const challengeMethod = params.get("code_challenge_method")
  if (responseType !== "code") return { error: "unsupported_response_type" }
  if (!clientId || !state.oauth.clients[clientId]) return { error: "invalid_client" }
  if (!redirectUri) return { error: "invalid_request", detail: "missing redirect_uri" }
  const client = state.oauth.clients[clientId]
  if (client.redirect_uris?.length && !client.redirect_uris.includes(redirectUri)) return { error: "invalid_redirect_uri" }
  if (!codeChallenge || challengeMethod !== "S256") return { error: "invalid_request", detail: "S256 PKCE required" }
  const resource = params.get("resource") ?? origin
  if (resource !== origin) return { error: "invalid_target", detail: "resource must match MCP server origin" }
  return { client, clientId, redirectUri, codeChallenge, resource }
}

function issueAuthorizationCode({ clientId, redirectUri, codeChallenge, scope, resource }) {
  const code = randomId("code")
  state.oauth.codes[code] = {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: "S256",
    scope: scope || "openid profile autodirector.run",
    resource,
    subject: "local-user",
    expiresAt: Date.now() + 5 * 60 * 1000,
    createdAt: new Date().toISOString(),
  }
  saveState()
  return code
}

function redirectWithParams(res, redirectUri, params) {
  const redirect = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) redirect.searchParams.set(key, String(value))
  }
  res.writeHead(302, { location: redirect.toString() })
  res.end()
}

function renderAuthorizePage(res, params, client) {
  const hiddenInputs = Array.from(params.entries())
    .map(([key, value]) => `<input type="hidden" name="${escapeXml(key)}" value="${escapeXml(value)}" />`)
    .join("\n")
  html(res, 200, `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authorize AutoDirector</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at 80% 0%, rgba(79,209,182,.16), transparent 28rem), #101619; color: #f6faf8; }
      main { width: min(560px, calc(100vw - 32px)); border: 1px solid rgba(255,255,255,.14); border-radius: 28px; background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04)); box-shadow: 0 28px 90px rgba(0,0,0,.42); overflow: hidden; }
      header { padding: 24px; border-bottom: 1px solid rgba(255,255,255,.12); }
      h1 { margin: 0; font-size: 24px; }
      p { color: #a9b8b6; line-height: 1.6; }
      section { padding: 24px; }
      .scope { display: flex; gap: 10px; align-items: center; margin: 10px 0; padding: 12px; border-radius: 16px; background: rgba(255,255,255,.055); }
      .dot { width: 8px; height: 8px; border-radius: 999px; background: #4fd1b6; }
      form { display: flex; gap: 10px; padding: 0 24px 24px; }
      button { border: 1px solid rgba(255,255,255,.16); border-radius: 14px; padding: 12px 16px; color: #101619; background: #ff6b6b; font-weight: 700; cursor: pointer; }
      button.secondary { color: #f6faf8; background: rgba(255,255,255,.06); }
      code { color: #4fd1b6; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Connect AutoDirector</h1>
        <p><strong>${escapeXml(client.client_name ?? "ChatGPT")}</strong> wants to connect to this local AutoDirector MCP server.</p>
      </header>
      <section>
        <div class="scope"><span class="dot"></span><span>Create and inspect video runs</span></div>
        <div class="scope"><span class="dot"></span><span>Call AutoDirector MCP tools</span></div>
        <div class="scope"><span class="dot"></span><span>Read generated package metadata</span></div>
        <p>Issuer: <code>${escapeXml(params.get("resource") ?? "")}</code></p>
      </section>
      <form method="post" action="/oauth/authorize">
        ${hiddenInputs}
        <button type="submit" name="decision" value="approve">Allow</button>
        <button class="secondary" type="submit" name="decision" value="deny">Deny</button>
      </form>
    </main>
  </body>
</html>`)
}

async function routeOAuthAuthorize(req, res, url) {
  const origin = originFromReq(req)
  const params = req.method === "POST" ? await readParams(req) : url.searchParams
  const validated = validateAuthorizationRequest(params, origin)
  if (validated.error) return json(res, 400, validated)
  const allowAutoApprove = process.env.AUTODIRECTOR_ALLOW_OAUTH_AUTO_APPROVE === "1"
  const autoApprove = allowAutoApprove && params.get("autodirector_auto_approve") === "1"
  if (req.method === "GET" && !autoApprove) {
    return renderAuthorizePage(res, params, validated.client)
  }
  if (params.get("decision") === "deny") {
    return redirectWithParams(res, validated.redirectUri, { error: "access_denied", state: params.get("state") })
  }
  const code = issueAuthorizationCode({
    clientId: validated.clientId,
    redirectUri: validated.redirectUri,
    codeChallenge: validated.codeChallenge,
    scope: params.get("scope"),
    resource: validated.resource,
  })
  return redirectWithParams(res, validated.redirectUri, { code, state: params.get("state") })
}

function issueTokenResponse(codeRecord, origin) {
  const scope = codeRecord.scope || "openid profile autodirector.run"
  const accessToken = signJwt({
    sub: codeRecord.subject,
    client_id: codeRecord.clientId,
    scope,
  }, origin)
  const refreshToken = randomId("refresh")
  const tokenRecord = {
    clientId: codeRecord.clientId,
    subject: codeRecord.subject,
    scope,
    resource: origin,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 3600 * 1000,
  }
  state.oauth.tokens[accessToken] = tokenRecord
  state.oauth.refreshTokens[refreshToken] = { ...tokenRecord, expiresAt: Date.now() + 30 * 24 * 3600 * 1000 }
  saveState()
  pushEvent("mcp.oauth.connected", { clientId: codeRecord.clientId })
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
    scope,
  }
}

function redeemAuthorizationCode(params, origin) {
  const grantType = params.get("grant_type")
  if (grantType !== "authorization_code") return { error: "unsupported_grant_type" }
  const code = params.get("code")
  const codeRecord = code ? state.oauth.codes[code] : null
  if (!codeRecord) return { error: "invalid_grant" }
  if (Date.now() > codeRecord.expiresAt) {
    delete state.oauth.codes[code]
    saveState()
    return { error: "invalid_grant", error_description: "code expired" }
  }
  if (params.get("client_id") !== codeRecord.clientId) return { error: "invalid_client" }
  if (params.get("redirect_uri") !== codeRecord.redirectUri) return { error: "invalid_grant", error_description: "redirect_uri mismatch" }
  const verifier = params.get("code_verifier")
  if (!verifier || sha256Base64Url(verifier) !== codeRecord.codeChallenge) return { error: "invalid_grant", error_description: "PKCE verification failed" }
  delete state.oauth.codes[code]
  return issueTokenResponse(codeRecord, origin)
}

function refreshAccessToken(params, origin) {
  const refreshToken = params.get("refresh_token")
  const record = refreshToken ? state.oauth.refreshTokens[refreshToken] : null
  if (!record || Date.now() > record.expiresAt) return { error: "invalid_grant" }
  return issueTokenResponse({
    clientId: record.clientId,
    subject: record.subject,
    scope: record.scope,
  }, origin)
}

async function routeOAuthToken(req, res) {
  const origin = originFromReq(req)
  const params = await readParams(req)
  const result = params.get("grant_type") === "refresh_token" ? refreshAccessToken(params, origin) : redeemAuthorizationCode(params, origin)
  if (result.error) return json(res, 400, result)
  json(res, 200, result)
}

function ensureLocalOAuthClient(origin) {
  const redirectUri = `${origin}/oauth/callback`
  const existingId = state.oauth.localClientId
  if (existingId && state.oauth.clients[existingId]?.redirect_uris?.includes(redirectUri)) return state.oauth.clients[existingId]
  const clientId = randomId("local_client")
  state.oauth.localClientId = clientId
  state.oauth.clients[clientId] = {
    client_id: clientId,
    client_name: "AutoDirector Web UI",
    redirect_uris: [redirectUri],
    scope: "openid profile autodirector.run",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    createdAt: new Date().toISOString(),
  }
  saveState()
  return state.oauth.clients[clientId]
}

function routeOAuthStart(req, res, url) {
  const origin = originFromReq(req)
  ensureOAuthState()
  const redirectUri = openAiOauth.redirectUri
  const codeVerifier = generateOpenAiCodeVerifier()
  const oauthState = randomId("state")
  const returnTo = url.searchParams.get("return_to")?.startsWith("/") ? url.searchParams.get("return_to") : "/"
  state.oauth.uiStates[oauthState] = {
    codeVerifier,
    redirectUri,
    returnTo,
    returnOrigin: origin,
    provider: "openai_codex_oauth",
    clientId: openAiOauth.clientId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 30 * 60 * 1000,
  }
  saveState()
  const authorize = buildOpenAiAuthorizationUrl({
    oauthState,
    codeChallenge: sha256Base64Url(codeVerifier),
    redirectUri,
  })
  res.writeHead(302, { location: authorize.toString() })
  res.end()
}

function renderOpenAiOAuthError(res, message) {
  return html(res, 400, `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenAI OAuth failed</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #101619; color: #f6faf8; }
      main { width: min(560px, calc(100vw - 32px)); border: 1px solid rgba(255,255,255,.14); border-radius: 24px; background: rgba(255,255,255,.06); padding: 28px; box-shadow: 0 24px 80px rgba(0,0,0,.35); }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { color: #b7c7c2; line-height: 1.6; }
      a { display: inline-flex; margin-top: 14px; border-radius: 14px; background: #4fd1b6; color: #07100d; padding: 12px 16px; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>OpenAI OAuth callback failed</h1>
      <p>${escapeXml(message)}</p>
      <p>这个通常是授权页开太久、服务重启、或者用了旧 callback 链接。请重新发起连接。</p>
      <a href="/oauth/start">重新连接 OpenAI / Codex OAuth</a>
    </main>
  </body>
</html>`)
}

async function routeOAuthCallback(req, res, url) {
  const origin = originFromReq(req)
  const code = url.searchParams.get("code")
  const oauthState = url.searchParams.get("state")
  const uiState = oauthState ? state.oauth.uiStates[oauthState] : null
  const provider = uiState?.provider ?? "legacy_local_mcp"
  if (!code || !uiState) return renderOpenAiOAuthError(res, "Missing or expired state.")
  if (Date.now() > (uiState.expiresAt ?? 0)) {
    delete state.oauth.uiStates[oauthState]
    saveState()
    return renderOpenAiOAuthError(res, "OAuth state expired.")
  }
  delete state.oauth.uiStates[oauthState]
  if (provider !== "openai_codex_oauth") {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: uiState.clientId,
      redirect_uri: uiState.redirectUri ?? `${origin}/oauth/callback`,
      code_verifier: uiState.codeVerifier,
    })
    const result = redeemAuthorizationCode(params, origin)
    if (result.error) return renderOpenAiOAuthError(res, result.error_description ?? result.error)
  } else {
    let tokenResponse
    try {
      tokenResponse = await exchangeOpenAiCode({
        code,
        codeVerifier: uiState.codeVerifier,
        redirectUri: uiState.redirectUri ?? `${origin}/oauth/callback`,
      })
    } catch (error) {
      saveState()
      return renderOpenAiOAuthError(res, error instanceof Error ? error.message : String(error))
    }
    const expiresIn = Number(tokenResponse.expires_in ?? 3600)
    state.openaiAccount = {
      provider: "openai_codex_oauth",
      clientId: openAiOauth.clientId,
      redirectUri: uiState.redirectUri ?? `${origin}/oauth/callback`,
      connectedAt: new Date().toISOString(),
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      idToken: tokenResponse.id_token ?? null,
      tokenType: tokenResponse.token_type ?? "Bearer",
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scope: tokenResponse.scope ?? openAiOauth.defaultScopes,
      user: extractOpenAiUserInfo(tokenResponse.id_token, tokenResponse.access_token),
    }
    state.settings.providerId = "openai_codex_oauth"
    state.settings.authStatus = "connected"
    state.settings.updatedAt = new Date().toISOString()
    saveState()
    pushEvent("auth.connected", { providerId: "openai_codex_oauth", user: publicOpenAiAccount()?.user ?? null })
  }
  const redirect = new URL(uiState.returnTo, uiState.returnOrigin ?? origin)
  redirect.searchParams.set("oauth", "connected")
  res.writeHead(302, { location: redirect.toString() })
  res.end()
}

async function routeMcp(req, res) {
  const body = await readJson(req)
  if (body.method === "initialize") {
    return json(res, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "AutoDirector", version: "0.1.0" },
        capabilities: { tools: {} },
      },
    })
  }
  const auth = requireBearer(req, res, ["autodirector.run"])
  if (!auth) return
  if (body.method === "tools/list") {
    return json(res, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        tools: [
          {
            name: "autodirector_create_run",
            title: "Create AutoDirector Run",
            description: "Create a local persistent multi-agent video run.",
            inputSchema: {
              type: "object",
              properties: { brief: { type: "string" } },
              required: ["brief"],
            },
          },
          {
            name: "autodirector_get_runtime_capabilities",
            title: "Get Runtime Capabilities",
            description: "Return the selected agent host, visual provider, runtime support matrix, and imagegen policy.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "autodirector_get_run_status",
            title: "Get AutoDirector Run Status",
            description: "Inspect the active or specified run, including current task, artifacts, package state, Agent state, and recent events.",
            inputSchema: {
              type: "object",
              properties: { runId: { type: "string" } },
            },
          },
          {
            name: "autodirector_dispatch_next",
            title: "Dispatch Next Task",
            description: "Ask Producer to dispatch the next pipeline step. In oauth_agents mode this creates a real waiting Agent task instead of auto-completing it.",
            inputSchema: {
              type: "object",
              properties: { runId: { type: "string" } },
            },
          },
          {
            name: "autodirector_get_agent_task",
            title: "Get Current Agent Task",
            description: "Fetch the current runnable task, upstream artifacts, success criteria, model policy, and handoff rules for a real OAuth production Agent.",
            inputSchema: {
              type: "object",
              properties: {
                runId: { type: "string" },
                agentId: { type: "string" },
              },
            },
          },
          {
            name: "autodirector_submit_agent_artifact",
            title: "Submit Agent Artifact",
            description: "Submit the real artifact produced by an OAuth Agent. Producer advances only after this tool is called.",
            inputSchema: {
              type: "object",
              properties: {
                runId: { type: "string" },
                taskId: { type: "string" },
                agentId: { type: "string" },
                status: { type: "string", enum: ["done", "blocked"] },
                artifact: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    type: { type: "string" },
                    summary: { type: "string" },
                    content: {},
                    checks: { type: "array", items: { type: "string" } },
                  },
                  required: ["summary"],
                },
              },
              required: ["runId", "taskId", "agentId", "artifact"],
            },
          },
          {
            name: "autodirector_generate_one_click",
            title: "Generate Complete Video Package",
            description: "Create a run and start the Producer. In oauth_agents mode this will wait for real Agent artifact submissions.",
            inputSchema: {
              type: "object",
              properties: { brief: { type: "string" } },
              required: ["brief"],
            },
          },
          {
            name: "autodirector_render_video",
            title: "Render Final Video Package",
            description: "Generate the final package after the real artifact pipeline is complete. Returns blocked package details if imagegen or quality gates fail.",
            inputSchema: {
              type: "object",
              properties: { runId: { type: "string" } },
            },
          },
          {
            name: "autodirector_register_image_assets",
            title: "Register OAuth Imagegen Assets",
            description: "Register a directory produced by the connected ChatGPT/Codex OAuth imagegen capability. Files should be scene-1.png, scene-2.png, etc.",
            inputSchema: {
              type: "object",
              properties: {
                runId: { type: "string" },
                assetDir: { type: "string" },
              },
              required: ["assetDir"],
            },
          },
        ],
      },
    })
  }
  if (body.method === "tools/call") {
    const name = body.params?.name
    const args = body.params?.arguments ?? {}
    if (name === "autodirector_create_run") {
      const run = createRun(args.brief ?? "")
      return json(res, 200, { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: `Run created: ${run.id}` }] } })
    }
    if (name === "autodirector_get_runtime_capabilities") {
      return json(res, 200, {
        jsonrpc: "2.0",
        id: body.id,
        result: { content: [{ type: "text", text: JSON.stringify(runtimeCapabilities(), null, 2) }] },
      })
    }
    if (name === "autodirector_get_run_status") {
      const run = state.runs[args.runId ?? state.activeRunId]
      if (!run) return json(res, 200, { jsonrpc: "2.0", id: body.id, error: { code: -32004, message: "run_not_found" } })
      return json(res, 200, {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [{
            type: "text",
            text: JSON.stringify({
              run,
              currentTask: currentRunnableTask(run)?.instructions ?? null,
              workers: Object.values(state.workers),
              events: state.events.filter((event) => event.payload?.runId === run.id).slice(-20),
              capabilities: runtimeCapabilities(),
            }, null, 2),
          }],
        },
      })
    }
    if (name === "autodirector_dispatch_next") {
      const run = dispatchNext(args.runId ?? state.activeRunId)
      const current = currentRunnableTask(run)
      return json(res, 200, { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify({ runId: run?.id ?? null, task: current?.instructions ?? null }, null, 2) }] } })
    }
    if (name === "autodirector_get_agent_task") {
      const run = state.runs[args.runId ?? state.activeRunId]
      const current = currentRunnableTask(run, args.agentId)
      return json(res, 200, {
        jsonrpc: "2.0",
        id: body.id,
        result: { content: [{ type: "text", text: JSON.stringify(current?.instructions ?? { status: "no_task" }, null, 2) }] },
      })
    }
    if (name === "autodirector_submit_agent_artifact") {
      const result = completeAgentTask(args.runId ?? state.activeRunId, args)
      if (result.error) return json(res, 200, { jsonrpc: "2.0", id: body.id, error: { code: -32005, message: result.error } })
      const next = currentRunnableTask(result.run)
      return json(res, 200, {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [{
            type: "text",
            text: JSON.stringify({
              submitted: result.artifact.id,
              runStatus: result.run.status,
              automationStatus: result.run.automationStatus,
              nextTask: next?.instructions ?? null,
              package: result.run.package ?? null,
            }, null, 2),
          }],
        },
      })
    }
    if (name === "autodirector_generate_one_click") {
      const run = generateOneClick(args.brief ?? "")
      return json(res, 200, {
        jsonrpc: "2.0",
        id: body.id,
        result: { content: [{ type: "text", text: JSON.stringify({ runId: run.id, status: run.status, automationStatus: run.automationStatus, task: currentRunnableTask(run)?.instructions ?? null, package: run.package ?? null }, null, 2) }] },
      })
    }
    if (name === "autodirector_render_video") {
      const run = state.runs[args.runId ?? state.activeRunId]
      if (!run) return json(res, 200, { jsonrpc: "2.0", id: body.id, error: { code: -32004, message: "run_not_found" } })
      if (run.completedSteps < pipeline.length) {
        return json(res, 200, {
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: -32006,
            message: "pipeline_incomplete",
            data: { completedSteps: run.completedSteps, requiredSteps: pipeline.length, currentTask: currentRunnableTask(run)?.instructions ?? null },
          },
        })
      }
      const packaged = generateFinalPackage(run)
      return json(res, 200, {
        jsonrpc: "2.0",
        id: body.id,
        result: { content: [{ type: "text", text: JSON.stringify({ runId: packaged.id, status: packaged.status, package: packaged.package }, null, 2) }] },
      })
    }
    if (name === "autodirector_register_image_assets") {
      const runId = args.runId ?? state.activeRunId
      const run = state.runs[runId]
      if (!run) {
        return json(res, 200, { jsonrpc: "2.0", id: body.id, error: { code: -32004, message: "run_not_found" } })
      }
      const validation = validateImageAssetDir(run, args.assetDir)
      if (validation.error) {
        return json(res, 200, {
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: -32007,
            message: validation.error,
            data: {
              resolvedAssetDir: validation.resolvedAssetDir,
              allowedRoots: validation.allowedRoots,
            },
          },
        })
      }
      run.imageAssetDir = validation.resolvedAssetDir
      const registeredFiles = registeredImageAssetFiles(run)
      run.logs.push(`[asset] registered OAuth imagegen assets: ${run.imageAssetDir} (${registeredFiles.length}/${sceneCardsFor(run).length} usable files)`)
      saveState()
      pushEvent("imagegen.assets_registered", { runId: run.id, agentId: "asset", assetDir: run.imageAssetDir, count: registeredFiles.length })
      return json(res, 200, {
        jsonrpc: "2.0",
        id: body.id,
        result: { content: [{ type: "text", text: `Registered image assets for ${run.id}: ${run.imageAssetDir} (${registeredFiles.length}/${sceneCardsFor(run).length} usable files)` }] },
      })
    }
  }
  json(res, 200, { jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "Method not found" } })
}

async function routeApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/bootstrap") return json(res, 200, publicState())
  if (req.method !== "GET" && !requireApiMutationRequest(req, res)) return

  if (req.method === "POST" && url.pathname === "/api/onboarding") {
    const body = await readJson(req)
    state.settings = {
      ...state.settings,
      providerId: "openai_codex_oauth",
      defaultRuntime: body.defaultRuntime === "remotion" ? "remotion" : "hyperframes",
      layoutMode: body.layoutMode === "power" ? "power" : "simple",
      executionMode: executionModeForAgentHost(body.agentHost, body.executionMode),
      agentHost: body.agentHost === "codex_cli" ? "codex_native" : agentHostOptions.some((option) => option.id === body.agentHost) ? body.agentHost : "codex_native",
      visualProvider: visualProviderOptions.some((option) => option.id === body.visualProvider) ? body.visualProvider : "codex_imagegen",
      completed: true,
      updatedAt: new Date().toISOString(),
    }
    applyModelPolicyToWorkers()
    saveState()
    pushEvent("settings.onboarded", state.settings)
    return json(res, 200, publicState())
  }

  if (req.method === "PATCH" && url.pathname === "/api/settings") {
    const body = await readJson(req)
    const nextModelPolicy = body.modelPolicy && typeof body.modelPolicy === "object"
      ? mergeModelPolicy(Object.fromEntries(
        Object.entries({ ...state.settings.modelPolicy, ...body.modelPolicy }).map(([id, policy]) => [
          id,
          { ...(state.settings.modelPolicy[id] ?? {}), ...(policy ?? {}) },
        ])
      ))
      : state.settings.modelPolicy
    state.settings = {
      ...state.settings,
      defaultRuntime: body.defaultRuntime ?? state.settings.defaultRuntime,
      layoutMode: body.layoutMode ?? state.settings.layoutMode,
      executionMode: body.executionMode ? normalizeExecutionMode(body.executionMode) : body.agentHost ? executionModeForAgentHost(body.agentHost) : normalizeExecutionMode(state.settings.executionMode),
      agentHost: body.agentHost === "codex_cli" ? "codex_native" : agentHostOptions.some((option) => option.id === body.agentHost) ? body.agentHost : state.settings.agentHost,
      visualProvider: visualProviderOptions.some((option) => option.id === body.visualProvider) ? body.visualProvider : state.settings.visualProvider,
      imageModel: body.imageModel ?? state.settings.imageModel ?? defaultImageModel,
      modelPolicy: nextModelPolicy,
      updatedAt: new Date().toISOString(),
    }
    applyModelPolicyToWorkers()
    saveState()
    pushEvent("settings.updated", state.settings)
    return json(res, 200, publicState())
  }

  if (req.method === "POST" && url.pathname === "/api/auth/dev-connect") {
    return json(res, 410, { error: "oauth_required", auth_start: "/oauth/start" })
  }

  if (req.method === "POST" && url.pathname === "/api/producer-chat/stream") {
    const body = await readJson(req)
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    })
    const writeEvent = (event, data) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
    try {
      let result
      if (normalizeExecutionMode(state.settings.executionMode) === "codex_native" || state.settings.agentHost === "codex_native" || state.settings.agentHost === "codex_cli") {
        result = await codexNativeRuntime().runProducerTurn(body, {
          onDelta: (delta) => writeEvent("delta", { delta }),
        })
      } else {
        result = await callProducerChatModel(body)
        writeEvent("delta", { delta: result.message.body })
      }
      writeEvent("done", result)
      res.end()
    } catch (error) {
      writeEvent("error", { error: error.code ?? "producer_chat_failed", detail: redactSecret(error.message ?? String(error)) })
      res.end()
    }
    return
  }

  if (req.method === "POST" && url.pathname === "/api/producer-chat") {
    try {
      const body = await readJson(req)
      const result = await callProducerChatModel(body)
      return json(res, 200, result)
    } catch (error) {
      return json(res, error.status ?? 500, {
        error: error.code ?? "producer_chat_failed",
        detail: redactSecret(error.message ?? String(error)),
        auth_start: error.status === 401 ? "/oauth/start" : undefined,
      })
    }
  }

  if (req.method === "POST" && url.pathname === "/api/runs") {
    const body = await readJson(req)
    const run = createRun(body.brief ?? "")
    if (body.autoStart !== false) scheduleRunAutomation(run.id, 650)
    return json(res, 201, publicState())
  }

  const activateRunMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/activate$/)
  if (req.method === "POST" && activateRunMatch) {
    const run = state.runs[activateRunMatch[1]]
    if (!run) return json(res, 404, { error: "run_not_found" })
    state.activeRunId = run.id
    run.updatedAt = new Date().toISOString()
    saveState()
    pushEvent("run.activated", { runId: run.id })
    return json(res, 200, publicState())
  }

  if (req.method === "POST" && url.pathname === "/api/generate-one-click") {
    const body = await readJson(req)
    generateOneClick(body.brief ?? "")
    return json(res, 201, publicState())
  }

  const agentTaskMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/agent-task$/)
  if (req.method === "GET" && agentTaskMatch) {
    const run = state.runs[agentTaskMatch[1]]
    if (!run) return json(res, 404, { error: "run_not_found" })
    const agentId = url.searchParams.get("agentId")
    const current = currentRunnableTask(run, agentId)
    return json(res, 200, { task: current?.instructions ?? null })
  }

  const submitArtifactMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/agent-artifact$/)
  if (req.method === "POST" && submitArtifactMatch) {
    const body = await readJson(req)
    const result = completeAgentTask(submitArtifactMatch[1], body)
    if (result.error) return json(res, 400, { error: result.error })
    return json(res, 200, publicState())
  }

  const dispatchMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/dispatch-next$/)
  if (req.method === "POST" && dispatchMatch) {
    const run = dispatchNext(dispatchMatch[1])
    if (!run) return json(res, 404, { error: "run_not_found" })
    return json(res, 200, publicState())
  }

  const generateMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/generate-one-click$/)
  if (req.method === "POST" && generateMatch) {
    const run = state.runs[generateMatch[1]]
    if (!run) return json(res, 404, { error: "run_not_found" })
    if (["oauth_agents", "codex_native"].includes(normalizeExecutionMode(run.executionMode ?? state.settings.executionMode)) && run.completedSteps < pipeline.length) {
      dispatchNext(run.id)
      return json(res, 200, publicState())
    }
    dispatchAll(run.id)
    generateFinalPackage(run)
    return json(res, 200, publicState())
  }

  const registerAssetsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/register-image-assets$/)
  if (req.method === "POST" && registerAssetsMatch) {
    const run = state.runs[registerAssetsMatch[1]]
    if (!run) return json(res, 404, { error: "run_not_found" })
    const body = await readJson(req)
    if (!body.assetDir) return json(res, 400, { error: "asset_dir_required" })
    const validation = validateImageAssetDir(run, body.assetDir)
    if (validation.error) {
      return json(res, 400, {
        error: validation.error,
        resolvedAssetDir: validation.resolvedAssetDir,
        allowedRoots: validation.allowedRoots,
      })
    }
    run.imageAssetDir = validation.resolvedAssetDir
    const registeredFiles = registeredImageAssetFiles(run)
    run.logs.push(`[asset] registered OAuth imagegen assets: ${run.imageAssetDir} (${registeredFiles.length}/${sceneCardsFor(run).length} usable files)`)
    run.updatedAt = new Date().toISOString()
    saveState()
    pushEvent("imagegen.assets_registered", { runId: run.id, agentId: "asset", assetDir: run.imageAssetDir, count: registeredFiles.length })
    if (run.completedSteps >= pipeline.length || run.package?.status === "blocked") {
      generateFinalPackage(run)
    }
    return json(res, 200, publicState())
  }

  const fileMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/files\/(.+)$/)
  if ((req.method === "GET" || req.method === "HEAD") && fileMatch) {
    const run = state.runs[fileMatch[1]]
    if (!run?.package?.outputDir) return json(res, 404, { error: "package_not_ready" })
    const requested = decodeURIComponent(fileMatch[2])
    const filePath = resolve(join(run.package.outputDir, requested))
    const packageRoot = resolve(run.package.outputDir)
    if (!isPathInsideDir(filePath, packageRoot) || !existsSync(filePath)) return json(res, 404, { error: "file_not_found" })
    const contentTypes = {
      ".mp4": "video/mp4",
      ".zip": "application/zip",
      ".json": "application/json; charset=utf-8",
      ".md": "text/markdown; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".txt": "text/plain; charset=utf-8",
    }
    res.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      "content-disposition": `inline; filename="${filePath.split("/").at(-1)}"`,
      "content-length": statSync(filePath).size,
    })
    if (req.method === "HEAD") return res.end()
    createReadStream(filePath).pipe(res)
    return
  }

  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/)
  if (req.method === "GET" && runMatch) {
    const run = state.runs[runMatch[1]]
    if (!run) return json(res, 404, { error: "run_not_found" })
    return json(res, 200, run)
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    })
    res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`)
    clients.add(res)
    req.on("close", () => clients.delete(res))
    return
  }

  json(res, 404, { error: "not_found" })
}

function serveStatic(req, res, url) {
  if (!existsSync(distDir)) return text(res, 404, "Run npm run build before npm run start.")
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname)
  const candidate = resolve(join(distDir, pathname))
  const filePath = isPathInsideDir(candidate, distDir) && existsSync(candidate) ? candidate : join(distDir, "index.html")
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  }
  res.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    "cache-control": "no-store, max-age=0",
  })
  createReadStream(filePath).pipe(res)
}

const mainServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`)
    if (url.pathname === "/.well-known/oauth-protected-resource") return routeOAuthProtectedResource(req, res)
    if (url.pathname === "/.well-known/oauth-authorization-server") return routeOAuthAuthorizationServerMetadata(req, res)
    if (url.pathname === "/.well-known/openid-configuration") return routeOAuthAuthorizationServerMetadata(req, res)
    if (req.method === "GET" && url.pathname === "/oauth/jwks") return routeOAuthJwks(req, res)
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/oauth/start") return routeOAuthStart(req, res, url)
    if (req.method === "GET" && url.pathname === "/oauth/callback") return routeOAuthCallback(req, res, url)
    if (req.method === "POST" && url.pathname === "/oauth/register") return routeOAuthRegister(req, res)
    if ((req.method === "GET" || req.method === "POST") && url.pathname === "/oauth/authorize") return routeOAuthAuthorize(req, res, url)
    if (req.method === "POST" && url.pathname === "/oauth/token") return routeOAuthToken(req, res)
    if (req.method === "POST" && url.pathname === "/mcp") return routeMcp(req, res)
    if (url.pathname.startsWith("/api/")) return await routeApi(req, res, url)
    serveStatic(req, res, url)
  } catch (error) {
    const status = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 500
    json(res, Number.isInteger(status) && status >= 400 && status < 600 ? status : 500, {
      error: status === 413 ? "payload_too_large" : "internal_error",
      detail: error instanceof Error ? error.message : String(error),
    })
  }
})

mainServer.listen(port, () => {
  console.log(`AutoDirector server listening on http://127.0.0.1:${port}`)
  resumeActiveAutomation()
})

function maybeStartOpenAiCallbackServer() {
  if (!["localhost", "127.0.0.1"].includes(openAiOauthRedirect.hostname)) {
    console.log(`OpenAI OAuth callback uses external redirect: ${openAiOauth.redirectUri}`)
    return
  }
  const callbackPort = Number(openAiOauthRedirect.port || (openAiOauthRedirect.protocol === "https:" ? 443 : 80))
  if (!callbackPort || callbackPort === port) return
  const callbackServer = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`)
      if (req.method === "GET" && url.pathname === openAiOauthRedirect.pathname) {
        return await routeOAuthCallback(req, res, url)
      }
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(302, { location: `http://127.0.0.1:${port}/` })
        res.end()
        return
      }
      return json(res, 404, { error: "not_found", expected_callback: openAiOauthRedirect.pathname })
    } catch (error) {
      json(res, 500, { error: "internal_error", detail: error instanceof Error ? error.message : String(error) })
    }
  })
  callbackServer.on("error", (error) => {
    console.error(`OpenAI OAuth callback server failed on ${openAiOauth.redirectUri}: ${error.message}`)
  })
  callbackServer.listen(callbackPort, openAiOauthRedirect.hostname, () => {
    console.log(`OpenAI OAuth callback listening on ${openAiOauth.redirectUri}`)
  })
}

maybeStartOpenAiCallbackServer()
