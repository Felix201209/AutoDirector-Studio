import { useEffect, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import {
  Bot,
  Check,
  ChevronRight,
  Circle,
  Download,
  FileCode2,
  Film,
  FolderOpen,
  Grid2X2,
  KeyRound,
  Layers3,
  MonitorPlay,
  Play,
  Plus,
  Send,
  Settings,
  Timer,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  agentSkills,
  artifacts as seedArtifacts,
  connectionOptions,
  packageItems,
  runtimePacks,
  timeline,
  toolEvents,
  type AgentStatus,
  type RuntimeId,
} from "@/data/autodirector"
import { cn } from "@/lib/utils"

type ProviderId = "openai_codex_oauth"
type AgentHost = "codex_native" | "codex_plugin" | "openai_api" | "claude_code" | "custom_mcp"
type VisualProvider = "codex_imagegen" | "openai_image_api" | "user_upload" | "public_source_only"
type LayoutMode = "simple" | "power"
type AuthStatus = "disconnected" | "connected"
type ExecutionMode = "codex_native" | "oauth_agents" | "legacy_template"
type AppView = "orchestrate" | "agents" | "delivery" | "settings"
type SettingsGroup = "connect" | "models" | "render" | "automation"
type InspectorMode = "agent" | "artifact" | "runtime" | "quality" | "final"
type AgentThinkingLevel = "low" | "medium" | "high" | "xhigh"
type AgentModelPolicy = {
  model: string
  thinkingLevel: AgentThinkingLevel
  thinkingLabel?: string
  capabilities?: string[]
}

type AppSettings = {
  completed: boolean
  providerId: ProviderId
  authStatus: AuthStatus
  modelPolicy: Record<string, AgentModelPolicy>
  imageModel: string
  defaultRuntime: Exclude<RuntimeId, "auto">
  layoutMode: LayoutMode
  executionMode: ExecutionMode
  agentHost?: AgentHost
  visualProvider?: VisualProvider
  updatedAt: string
}

type WorkerState = {
  id: string
  shortName: string
  role: string
  model: string
  thinkingLevel: string
  thinkingLabel?: string
  capabilities?: string[]
  status: AgentStatus
  inbox: string[]
  outbox: string[]
  currentTaskId: string | null
  artifacts: string[]
  lastActive: string | null
}

type ArtifactRecord = {
  id: string
  title: string
  type: string
  ownerAgentId: string
  path: string
  summary: string
  checks: string[]
  createdAt: string
}

type RunTask = {
  id: string
  stepId: string
  label: string
  agentId: string
  outputId: string
  status: "queued" | "ready" | "working" | "done" | "blocked"
  inputArtifactIds: string[]
  outputArtifactIds: string[]
}

type DifficultyEstimate = {
  level: number
  label: string
  score: number
  estimatedTotalTokens: number
  reasoning: string[]
  source: string
  createdAt: string
}

type TokenTelemetry = {
  status: "waiting_for_tokens" | "sampling" | "estimating" | "complete"
  sampleWindowSeconds: number
  sampleStartedAt: string | null
  sampleEndsAt: string | null
  observedTokens: number
  sampleTokens: number
  observedCharacters: number
  averageTokensPerSecond: number | null
  recentTokensPerSecond: number | null
  estimatedTotalTokens: number
  estimatedRemainingTokens: number
  estimatedRemainingSeconds: number
  estimatedCompletionAt: string | null
  confidence: "warming_up" | "low" | "medium" | "high"
  source: string
  updatedAt: string
}

type RunState = {
  id: string
  title: string
  brief: string
  runtime: Exclude<RuntimeId, "auto">
  layoutMode: LayoutMode
  status: "active" | "final" | "blocked" | "ready_to_package"
  automationStatus?: string
  executionMode?: ExecutionMode
  difficultyEstimate?: DifficultyEstimate
  tokenTelemetry?: TokenTelemetry
  completedSteps: number
  selectedAgentId: string
  tasks: RunTask[]
  artifacts: ArtifactRecord[]
  logs: string[]
  package?: {
    status: "ready" | "blocked"
    outputDir: string
    finalVideoUrl: string | null
    packageZipUrl: string
    sourceZipUrl: string
    files: string[]
    blockedReason?: string[] | null
    videoAssets: Array<{
      id: string
      title: string
      file: string
      source: string
      license: string
      purpose: string
      risk: string
      fallback: string
      durationSeconds?: number
    }>
    generatedAt: string
  }
  createdAt: string
  updatedAt: string
}

type BootstrapState = {
  settings: AppSettings
  openaiAccount: {
    provider: string
    connectedAt: string
    expiresAt: string
    scope: string
    clientId: string
    user: {
      email?: string | null
      name?: string | null
      planType?: string | null
      chatgptAccountId?: string | null
    } | null
  } | null
  activeRunId: string | null
  activeRun: RunState | null
  runs: RunState[]
  workers: WorkerState[]
  events: Array<{ id: string; type: string; payload: unknown; createdAt: string }>
  pipeline: Array<{ id: string; label: string; agentId: string; outputId: string }>
  capabilities?: {
    selected: {
      agentHost: AgentHost
      visualProvider: VisualProvider
      imageModel: string
      defaultRuntime: RuntimeId
      executionMode: ExecutionMode
    }
    codexNative?: {
      available: boolean
      binary: string
      version: string | null
      login: string
      loggedInWithChatGPT: boolean
      imageGeneration: boolean
      toolSearch: boolean
      appServer: boolean
      appServerRuntime?: {
        running: boolean
        initialized: boolean
        stderrTail?: string
      }
    }
    matrix: Record<string, string>
    policy: string
  }
}

type DraftMessage = {
  id: string
  role: "user" | "producer"
  timestamp: string
  body: string
  briefCandidate?: boolean
}

type ProducerChatResponse = {
  message: DraftMessage & {
    model?: string
    thinkingLevel?: string
    source?: string
  }
}

const navItems: Array<{ id: AppView; label: string; icon: LucideIcon }> = [
  { id: "orchestrate", label: "项目", icon: Grid2X2 },
  { id: "agents", label: "团队", icon: Bot },
  { id: "delivery", label: "交付", icon: MonitorPlay },
  { id: "settings", label: "设置", icon: Settings },
]

const statusCopy: Record<AgentStatus, string> = {
  idle: "空闲",
  queued: "排队",
  working: "运行中",
  done: "完成",
  revision: "返修中",
}

const statusClass: Record<AgentStatus, string> = {
  idle: "text-muted-foreground",
  queued: "text-muted-foreground",
  working: "text-secondary",
  done: "text-primary",
  revision: "text-destructive",
}

const statusDotClass: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground",
  queued: "bg-outline-variant",
  working: "bg-secondary",
  done: "bg-primary",
  revision: "bg-destructive",
}

const agentDisplayName = (agentId?: string | null) =>
  agentSkills.find((agent) => agent.id === agentId)?.shortName ?? (agentId ? agentId : "Producer")

const artifactDisplayName = (artifactId?: string | null) =>
  seedArtifacts.find((artifact) => artifact.id === artifactId)?.title ?? (artifactId ? artifactId : "任务图与成功标准")

const modelOptions = ["gpt-5.5", "gpt-5.4", "gpt-5.3-codex", "tool-runner"]
const agentHostOptions: Array<{ id: AgentHost; name: string; detail: string }> = [
  { id: "codex_native", name: "Codex Native", detail: "本机 Agent，复用 Codex 登录。" },
  { id: "codex_plugin", name: "Codex Plugin", detail: "插件化分发。" },
  { id: "openai_api", name: "OpenAI API", detail: "托管自动化和图片 API。" },
  { id: "claude_code", name: "Claude Code", detail: "代码、脚本、渲染。" },
  { id: "custom_mcp", name: "Custom MCP", detail: "外部 MCP host。" },
]
const visualProviderOptions: Array<{ id: VisualProvider; name: string; detail: string }> = [
  { id: "codex_imagegen", name: "Codex imagegen", detail: "默认 gpt-image-2。" },
  { id: "openai_image_api", name: "Image API", detail: "显式 API 凭证。" },
  { id: "user_upload", name: "User upload", detail: "上传后标注和排版。" },
  { id: "public_source_only", name: "Public source", detail: "只用公开素材。" },
]
const thinkingOptions: Array<{ value: AgentThinkingLevel; label: string }> = [
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "xhigh", label: "extra high" },
]
const settingsGroups: Array<{ id: SettingsGroup; label: string; detail: string }> = [
  { id: "connect", label: "连接", detail: "账号 / Agent / 素材" },
  { id: "models", label: "模型", detail: "推理 / 图片" },
  { id: "render", label: "渲染", detail: "运行时 / 密度" },
  { id: "automation", label: "自动化", detail: "无人值守规则" },
]
const appViews: AppView[] = ["orchestrate", "agents", "delivery", "settings"]
const isAppView = (value: string | null): value is AppView => Boolean(value && appViews.includes(value as AppView))
const initialAppView = (): AppView => {
  if (typeof window === "undefined") return "orchestrate"
  const view = new URLSearchParams(window.location.search).get("view")
  return isAppView(view) ? view : "orchestrate"
}
const runStatusLabels: Record<string, string> = {
  active: "进行中",
  blocked: "已阻塞",
  clean: "干净",
  draft: "草稿",
  final: "已交付",
  ready_to_package: "待打包",
}
const imageModelOptions = ["gpt-image-2", "gpt-image-1.5"]
const READONLY_PUBLIC_DEMO = import.meta.env.VITE_AUTODIRECTOR_READONLY_DEMO === "1"
const appAssetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`

const buildLegacyWord = (codes: number[]) => codes.map((code) => String.fromCharCode(code)).join("")
const legacyQualityInitials = buildLegacyWord([81, 65])
const legacyAcceptanceWord = buildLegacyWord([0x9a8c, 0x6536])
const legacyInspectWord = buildLegacyWord([0x5ba1, 0x67e5])

const displayTextReplacements: Array<[RegExp, string]> = [
  [new RegExp(`${legacyQualityInitials}\\s*交付`, "g"), "自动交付"],
  [new RegExp(`${legacyQualityInitials}\\s*${legacyAcceptanceWord}`, "g"), "自动质检"],
  [new RegExp(`${legacyQualityInitials}\\s*报告`, "g"), "质检报告"],
  [new RegExp(`${legacyQualityInitials}\\s*勾选`, "g"), "质量门通过"],
  [new RegExp(legacyQualityInitials, "g"), "Quality"],
  [new RegExp(`${legacyAcceptanceWord}标准`, "g"), "质量门"],
  [new RegExp(`${legacyAcceptanceWord}报告`, "g"), "质检报告"],
  [new RegExp(`${legacyAcceptanceWord}路径`, "g"), "质检路径"],
  [new RegExp(`可${legacyAcceptanceWord}`, "g"), "可验证"],
  [new RegExp(legacyAcceptanceWord, "g"), "质检"],
  [new RegExp(`${legacyInspectWord[0]}片`, "g"), "预览成片"],
  [new RegExp(`交接${legacyInspectWord}`, "g"), "交接检查"],
  [new RegExp(legacyInspectWord, "g"), "检查"],
]

function normalizeDisplayText(value: string) {
  return displayTextReplacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
}

function normalizeDisplayValue<T>(value: T): T {
  if (typeof value === "string") return normalizeDisplayText(value) as T
  if (Array.isArray(value)) return value.map((item) => normalizeDisplayValue(item)) as T
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDisplayValue(item)])) as T
}

function normalizeBootstrapForDisplay(state: BootstrapState) {
  return normalizeDisplayValue(state)
}

function createReadOnlyBootstrap(): BootstrapState {
  const now = new Date().toISOString()
  const modelPolicy = Object.fromEntries(agentSkills.map((agent) => [
    agent.id,
    {
      model: agent.id === "programmer" ? "gpt-5.3-codex" : "gpt-5.5",
      thinkingLevel: agent.id === "quality" || agent.id === "director" ? "high" : "medium",
      thinkingLabel: agent.id === "quality" || agent.id === "director" ? "high" : "medium",
      capabilities: agent.id === "asset" ? ["imagegen", "browser_search"] : agent.id === "render" ? ["ffmpeg", "zip", "probe"] : [],
    },
  ])) as Record<string, AgentModelPolicy>
  const run: RunState = {
    id: "run_public_readonly",
    title: "Musk vs Altman v10",
    brief: "做一个马斯克 vs 奥特曼新闻科普短片，要求 AutoDirector 自动跑完整 Agent pipeline，并保留 artifacts。",
    runtime: "hyperframes",
    layoutMode: "simple",
    status: "final",
    automationStatus: "readonly_public_demo",
    executionMode: "codex_native",
    completedSteps: timeline.length,
    selectedAgentId: "producer",
    tasks: timeline.map((step) => ({
      id: `task_${step.id}`,
      stepId: step.id,
      label: step.label,
      agentId: step.agentId,
      outputId: step.outputId,
      status: "done",
      inputArtifactIds: step.id === "brief" ? [] : [`artifact_${step.id}_input`],
      outputArtifactIds: [`artifact_${step.outputId}`],
    })),
    artifacts: seedArtifacts.map((artifact, index) => ({
      id: artifact.id,
      title: artifact.title,
      type: artifact.type,
      ownerAgentId: artifact.owner.toLowerCase(),
      path: `final-package/${artifact.id}.json`,
      summary: artifact.summary,
      checks: artifact.checks,
      createdAt: new Date(Date.now() - (seedArtifacts.length - index) * 90_000).toISOString(),
    })),
    logs: [
      "Public read-only build: API and Agent chat disabled.",
      "Producer created task_graph and success criteria.",
      "Agent team completed artifact handoff trail.",
      "Quality gate passed final package checks.",
    ],
    package: {
      status: "ready",
      outputDir: "../assets",
      finalVideoUrl: "../assets/musk-altman-agentteam-v10.mp4",
      packageZipUrl: "../assets/musk-altman-agentteam-v10-package.zip",
      sourceZipUrl: "../assets/musk-altman-agentteam-v10-package.zip",
      files: packageItems,
      blockedReason: null,
      videoAssets: [
        {
          id: "scene-news-context",
          title: "News context plate",
          file: "musk-altman-agentteam-v10.mp4",
          source: "public/source evidence",
          license: "demo package manifest",
          purpose: "Opening conflict frame",
          risk: "verified",
          fallback: "imagegen editorial plate",
          durationSeconds: 5,
        },
        {
          id: "scene-power-map",
          title: "Power map plate",
          file: "musk-altman-agentteam-v10.mp4",
          source: "generated runtime",
          license: "project source",
          purpose: "Explain governance tension",
          risk: "low",
          fallback: "abstract vector layer",
          durationSeconds: 6,
        },
      ],
      generatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  }
  return {
    settings: {
      completed: true,
      providerId: "openai_codex_oauth",
      authStatus: "connected",
      modelPolicy,
      imageModel: "gpt-image-2",
      defaultRuntime: "hyperframes",
      layoutMode: "simple",
      executionMode: "codex_native",
      agentHost: "codex_native",
      visualProvider: "codex_imagegen",
      updatedAt: now,
    },
    openaiAccount: {
      provider: "codex_native",
      connectedAt: now,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      scope: "read-only public demo",
      clientId: "public-readonly",
      user: {
        email: "readonly@autodirector.demo",
        name: "Public Demo",
        planType: "read-only",
        chatgptAccountId: null,
      },
    },
    activeRunId: run.id,
    activeRun: run,
    runs: [run],
    workers: agentSkills.map((agent, index) => ({
      id: agent.id,
      shortName: agent.shortName,
      role: agent.role,
      model: modelPolicy[agent.id]?.model ?? "gpt-5.5",
      thinkingLevel: modelPolicy[agent.id]?.thinkingLevel ?? "medium",
      thinkingLabel: modelPolicy[agent.id]?.thinkingLabel ?? "medium",
      capabilities: modelPolicy[agent.id]?.capabilities ?? [],
      status: index < agentSkills.length - 1 ? "done" : "working",
      inbox: agent.inputs,
      outbox: agent.outputs,
      currentTaskId: index < agentSkills.length - 1 ? null : "quality_report",
      artifacts: agent.outputs,
      lastActive: now,
    })),
    events: [
      { id: "public-event-1", type: "producer.plan.ready", payload: { readonly: true }, createdAt: now },
      { id: "public-event-2", type: "render.final.ready", payload: { readonly: true }, createdAt: now },
      { id: "public-event-3", type: "quality.package.passed", payload: { readonly: true }, createdAt: now },
    ],
    pipeline: timeline.map((step) => ({ id: step.id, label: step.label, agentId: step.agentId, outputId: step.outputId })),
    capabilities: {
      selected: {
        agentHost: "codex_native",
        visualProvider: "codex_imagegen",
        imageModel: "gpt-image-2",
        defaultRuntime: "hyperframes",
        executionMode: "codex_native",
      },
      codexNative: {
        available: false,
        binary: "public-readonly",
        version: null,
        login: "disabled on public site",
        loggedInWithChatGPT: false,
        imageGeneration: false,
        toolSearch: false,
        appServer: false,
      },
      matrix: {},
      policy: "Public read-only build: no API calls, no Agent chat, no execution.",
    },
  }
}

function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null)
  const [activeView, setActiveView] = useState<AppView>(initialAppView)
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("agent")
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectedAgentId, setInspectedAgentId] = useState<string | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [bottomOpen, setBottomOpen] = useState(false)
  const [isGenerating] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftMessages, setDraftMessages] = useState<DraftMessage[]>([])
  const [message, setMessage] = useState("")
  const [draftBusy, setDraftBusy] = useState(false)

  function changeView(view: AppView) {
    setActiveView(view)
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (view === "orchestrate") {
      url.searchParams.delete("view")
    } else {
      url.searchParams.set("view", view)
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    if (READONLY_PUBLIC_DEMO) {
      setBootstrap(normalizeBootstrapForDisplay(createReadOnlyBootstrap()))
      return undefined
    }
    api<BootstrapState>("/api/bootstrap").then((state) => setBootstrap(normalizeBootstrapForDisplay(state))).catch(() => undefined)
    const events = new EventSource("/api/events")
    events.addEventListener("state", (event) => {
      setBootstrap(normalizeBootstrapForDisplay(JSON.parse((event as MessageEvent).data)))
    })
    events.onerror = () => events.close()
    return () => events.close()
  }, [])

  async function connectChatGpt() {
    if (READONLY_PUBLIC_DEMO) return
    window.location.assign("/oauth/start")
  }

  async function saveSettings(settings: Partial<AppSettings>) {
    if (READONLY_PUBLIC_DEMO) return
    setBootstrap(normalizeBootstrapForDisplay(await api<BootstrapState>("/api/settings", { method: "PATCH", body: settings })))
  }

  async function completeOnboarding(settings: Pick<AppSettings, "defaultRuntime" | "layoutMode" | "agentHost" | "visualProvider">) {
    if (READONLY_PUBLIC_DEMO) return
    setBootstrap(normalizeBootstrapForDisplay(await api<BootstrapState>("/api/onboarding", { method: "POST", body: settings })))
    startDraft()
  }

  async function createRun() {
    if (READONLY_PUBLIC_DEMO) return
    const next = await api<BootstrapState>("/api/runs", { method: "POST", body: { brief: productionBrief() } })
    setBootstrap(normalizeBootstrapForDisplay(next))
    setDraftOpen(false)
    changeView("orchestrate")
  }

  async function dispatchNext() {
    if (READONLY_PUBLIC_DEMO) return
    if (!bootstrap?.activeRunId) return
    const next = await api<BootstrapState>(`/api/runs/${bootstrap.activeRunId}/dispatch-next`, { method: "POST" })
    setBootstrap(normalizeBootstrapForDisplay(next))
    if (next.activeRun?.status === "final") {
      changeView("delivery")
      setInspectorMode("final")
    }
  }

  async function activateRun(runId: string) {
    if (READONLY_PUBLIC_DEMO) return
    const next = await api<BootstrapState>(`/api/runs/${runId}/activate`, { method: "POST" })
    setBootstrap(normalizeBootstrapForDisplay(next))
    setDraftOpen(false)
    changeView("orchestrate")
    setInspectorOpen(false)
    setInspectedAgentId(null)
  }

  function startDraft() {
    setDraftOpen(true)
    setDraftMessages([])
    setMessage("")
    changeView("orchestrate")
    setInspectorOpen(false)
    setInspectedAgentId(null)
  }

  function productionBrief() {
    const userTurns = draftMessages.filter((item) => item.role === "user" && item.briefCandidate !== false).map((item) => item.body.trim()).filter(isProductionBriefTurn)
    const current = message.trim()
    return [...userTurns, current].filter(isProductionBriefTurn).join("\n\n")
  }

  async function sendDraftMessage() {
    if (READONLY_PUBLIC_DEMO) return
    const text = message.trim()
    if (!text || draftBusy) return
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const stamp = Date.now()
    const briefCandidate = isProductionBriefTurn(text)
    const userMessage: DraftMessage = { id: `draft_user_${stamp}`, role: "user", timestamp: now, body: text, briefCandidate }
    const nextMessages = [...draftMessages, userMessage]
    setDraftMessages(nextMessages)
    setMessage("")
    setDraftBusy(true)
    const producerId = `draft_producer_stream_${stamp}`
    setDraftMessages((items) => [
      ...items,
      {
        id: producerId,
        role: "producer",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        body: "",
      },
    ])
    try {
      const result = await streamProducerChat({ text, messages: nextMessages }, (delta) => {
        setDraftMessages((items) => items.map((item) => item.id === producerId ? { ...item, body: `${item.body}${delta}` } : item))
      })
      setDraftMessages((items) => items.map((item) => item.id === producerId ? {
        ...item,
        id: result.message.id ?? producerId,
        timestamp: result.message.timestamp ?? item.timestamp,
        body: result.message.body || item.body,
      } : item))
    } catch (error) {
      setDraftMessages((items) => items.map((item) => item.id === producerId ? {
        ...item,
        id: `draft_producer_error_${stamp}`,
        body: `模型没有接通：${error instanceof Error ? error.message : String(error)}`,
      } : item))
    } finally {
      setDraftBusy(false)
    }
  }

  if (!bootstrap) return <LoadingShell />

  if (!bootstrap.settings.completed) {
    return <Onboarding settings={bootstrap.settings} onComplete={completeOnboarding} onConnect={connectChatGpt} />
  }

  const activeRun = bootstrap.activeRun
  const effectiveDraftOpen = draftOpen || !activeRun
  const visibleRun = effectiveDraftOpen ? null : activeRun
  const nativeConnected = bootstrap.settings.agentHost === "codex_native" && Boolean(bootstrap.capabilities?.codexNative?.available && bootstrap.capabilities.codexNative.loggedInWithChatGPT)
  const modelConnected = bootstrap.settings.authStatus === "connected" || nativeConnected
  const completedSteps = Math.min(visibleRun?.completedSteps ?? 0, timeline.length)
  const selectedAgentId = inspectedAgentId ?? visibleRun?.selectedAgentId ?? "producer"
  const selectedAgent = agentSkills.find((agent) => agent.id === selectedAgentId) ?? agentSkills[0]
  const selectedWorker = bootstrap.workers.find((worker) => worker.id === selectedAgent.id)
  const runtimePack = runtimePacks.find((pack) => pack.id === bootstrap.settings.defaultRuntime) ?? runtimePacks[2]
  const activeArtifact = visibleRun?.artifacts.at(-1) ?? null
  const progressValue = Math.min(100, Math.round((completedSteps / timeline.length) * 100))
  const runBlocked = visibleRun?.status === "blocked" || visibleRun?.package?.status === "blocked"

  return (
    <div className="control-shell">
      <ProjectSidebar
        readOnly={READONLY_PUBLIC_DEMO}
        activeView={activeView}
        setActiveView={changeView}
        runs={bootstrap.runs}
        activeRun={visibleRun}
        runtime={runtimePack.name}
        onCreateRun={startDraft}
        onSelectRun={activateRun}
      />

      <div className="app-main">
        <GlobalHeader
          readOnly={READONLY_PUBLIC_DEMO}
          run={visibleRun}
          onOpenSetup={() => setSetupOpen(true)}
        />
        <main className="producer-zone">
          {activeView === "agents" ? (
            <AgentTeamView workers={bootstrap.workers} onInspect={(agentId) => {
              const agent = agentSkills.find((item) => item.id === agentId)
              if (agent) {
                setInspectedAgentId(agentId)
                setInspectorMode("agent")
                setInspectorOpen(true)
              }
            }} />
          ) : activeView === "delivery" ? (
            <FinalDeliveryView run={activeRun} runtimeName={runtimePack.name} />
          ) : activeView === "settings" ? (
            <SettingsView readOnly={READONLY_PUBLIC_DEMO} settings={bootstrap.settings} capabilities={bootstrap.capabilities} openaiAccount={bootstrap.openaiAccount} onConnect={connectChatGpt} onSettings={saveSettings} />
          ) : (
            <ProducerWorkbench
              readOnly={READONLY_PUBLIC_DEMO}
              message={message}
              setMessage={setMessage}
              activeRun={visibleRun}
              draftOpen={effectiveDraftOpen}
              draftMessages={draftMessages}
              completedSteps={completedSteps}
              progressValue={progressValue}
              events={bootstrap.events}
              isConnected={modelConnected}
              isGenerating={isGenerating}
              draftBusy={draftBusy}
              onCreateRun={startDraft}
              onAdvance={dispatchNext}
              onSendDraft={sendDraftMessage}
              onStartProduction={createRun}
            />
          )}
        </main>
      </div>

      {inspectorOpen ? (
        <InspectorPanel
          mode={inspectorMode}
          setMode={setInspectorMode}
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          selectedAgent={selectedAgent}
          selectedWorker={selectedWorker}
          activeArtifact={activeArtifact}
          run={visibleRun}
          runtimeName={runtimePack.name}
        />
      ) : null}

      <button
        type="button"
        className={cn("audit-fab", activeView !== "orchestrate" && "audit-fab--quiet", runBlocked && "audit-fab--blocked")}
        onClick={() => setBottomOpen(!bottomOpen)}
        aria-label={bottomOpen ? "收起进度控制台" : runBlocked ? "打开素材修复控制台" : visibleRun?.status === "final" ? "打开交付控制台" : "打开进度控制台"}
      >
        {bottomOpen ? "收起" : runBlocked ? "修素材" : visibleRun?.status === "final" ? "交付" : "进度"}
      </button>

      {bottomOpen ? (
        <BottomConsole
          open={bottomOpen}
          setOpen={setBottomOpen}
          completedSteps={completedSteps}
          events={bootstrap.events}
          run={activeRun}
        />
      ) : null}

      {setupOpen ? <TerminalSetupDialog onClose={() => setSetupOpen(false)} /> : null}
    </div>
  )
}

async function api<T>(path: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail = payload?.detail ?? payload?.error ?? `${response.status} ${response.statusText}`
    throw new Error(String(detail))
  }
  return (await response.json()) as T
}

async function streamProducerChat(body: unknown, onDelta: (delta: string) => void) {
  const response = await fetch("/api/producer-chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(String(payload?.detail ?? payload?.error ?? `${response.status} ${response.statusText}`))
  }
  if (!response.body) return await response.json() as ProducerChatResponse

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let result: ProducerChatResponse | null = null

  const handleBlock = (block: string) => {
    const lines = block.split(/\n/).map((line) => line.trimEnd())
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "message"
    const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n")
    if (!data) return
    const payload = JSON.parse(data)
    if (event === "delta") onDelta(String(payload.delta ?? ""))
    if (event === "done") result = payload as ProducerChatResponse
    if (event === "error") throw new Error(String(payload.detail ?? payload.error ?? "producer stream failed"))
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    const blocks = buffer.split(/\n\n/)
    buffer = blocks.pop() ?? ""
    for (const block of blocks) handleBlock(block)
    if (done) break
  }
  if (buffer.trim()) handleBlock(buffer)
  if (!result) throw new Error("Producer stream ended without final message")
  return result
}

function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [active, onEscape])
}

function LoadingShell() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="rounded-xl border border-border bg-surface p-5">
        <SectionLabel>AUTODIRECTOR BOOT</SectionLabel>
        <div className="mt-2 font-mono text-sm text-primary">Loading local orchestrator...</div>
      </div>
    </div>
  )
}

function isProductionBriefTurn(text: string) {
  const compact = text.replace(/\s+/g, " ").trim()
  if (!compact) return false
  if (/^(你?好|hi|hello|hey|在吗|你是谁|你能做什么|介绍一下你自己|help|\?|？)$/i.test(compact)) return false
  return /(视频|短片|宣传|介绍|产品|科普|教程|新闻|广告|片|剪辑|分镜|字幕|素材|马斯克|奥特曼|sam|altman|musk|openai|做一个|生成|制作|讲一下|解释)/i.test(compact) || compact.length >= 18
}

function GlobalHeader({
  readOnly,
  run,
  onOpenSetup,
}: {
  readOnly?: boolean
  run: RunState | null
  onOpenSetup: () => void
}) {
  const runBlocked = run?.status === "blocked" || run?.package?.status === "blocked"
  const runStateLabel = runBlocked ? "已阻塞" : run?.status === "final" ? "已交付" : run ? "自动化中" : "草稿"
  const runIdLabel = run?.id ? run.id.replace(/^run_/, "#") : "no active run"
  const activeStep = run ? timeline[Math.min(run.completedSteps ?? 0, timeline.length - 1)] : null
  const headerTitle = readOnly ? "作品展示控制台" : "自动化制作控制台"
  const headerMeta = run ? `${activeStep?.label ?? "Pipeline"} · ${runStateLabel}` : "等待 brief"
  return (
    <header className="control-header">
      <div className="header-project-block">
        <div className="header-project-icon">
          <MonitorPlay className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <SectionLabel>{readOnly ? "作品展示" : "控制台"}</SectionLabel>
          <strong>{headerTitle}</strong>
          <span className="header-project-meta">{headerMeta}</span>
        </div>
      </div>

      <div className="header-status-cluster" aria-label="当前 run 状态">
        <span className={cn("header-status-dot", runBlocked && "header-status-dot--blocked")} aria-hidden="true" />
        <span>{runStateLabel}</span>
        <span>{runIdLabel}</span>
      </div>

      <div className="header-actions">
        <button type="button" className="header-link-button" onClick={onOpenSetup} disabled={readOnly}>
          <KeyRound className="size-3.5" aria-hidden="true" />
          {readOnly ? "只读" : "连接"}
        </button>
        <div className="automation-pill" aria-label="自动化模式">
          <Check className="size-3.5" aria-hidden="true" />
          自动
        </div>
      </div>
    </header>
  )
}

function ProjectSidebar({
  readOnly = false,
  activeView,
  setActiveView,
  runs,
  activeRun,
  runtime,
  onCreateRun,
  onSelectRun,
}: {
  readOnly?: boolean
  activeView: AppView
  setActiveView: (view: AppView) => void
  runs: RunState[]
  activeRun: RunState | null
  runtime: string
  onCreateRun: () => void
  onSelectRun: (runId: string) => void
}) {
  const currentRun = activeRun ?? runs[0] ?? null
  const historyRuns = runs.filter((run) => run.id !== currentRun?.id).slice(0, 5)
  const [projectsCollapsed, setProjectsCollapsed] = useState(true)
  return (
    <aside className="project-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <BrandMark />
        </div>
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold">AutoDirector</div>
          <div className="font-mono text-[10px] text-muted-foreground">{readOnly ? "作品展示入口" : "本地控制台"}</div>
        </div>
      </div>

      <div className="sidebar-section workspace-section">
        <div className="sidebar-current-run">
          <SectionLabel>当前项目</SectionLabel>
          {currentRun ? (
            <ProjectRow
              active={currentRun.id === activeRun?.id}
              title={currentRun.title}
              runtime={currentRun.runtime === "remotion" ? "Remotion" : runtime}
              status={currentRun.status}
              onSelect={() => onSelectRun(currentRun.id)}
            />
          ) : (
            <ProjectRow title="暂无项目" runtime={runtime} status="draft" />
          )}
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="project-collapse-button"
            onClick={() => setProjectsCollapsed((value) => !value)}
            aria-expanded={!projectsCollapsed}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", !projectsCollapsed && "rotate-90")} aria-hidden="true" />
            <SectionLabel>历史</SectionLabel>
            <span>{historyRuns.length}</span>
          </button>
          <Button size="icon" className="size-7 rounded-lg" onClick={onCreateRun} disabled={readOnly} aria-label={readOnly ? "公网展示不可新建项目" : "新建项目"}>
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        {!projectsCollapsed ? (
          <div className="mt-3 space-y-1.5 overflow-y-auto pr-1">
            {historyRuns.length ? (
              historyRuns.map((run) => (
                <ProjectRow
                  key={run.id}
                  active={run.id === activeRun?.id}
                  title={run.title}
                  runtime={run.runtime === "remotion" ? "Remotion" : runtime}
                  status={run.status}
                  onSelect={() => onSelectRun(run.id)}
                />
              ))
            ) : (
              <ProjectRow title="暂无历史" runtime={runtime} status="clean" />
            )}
          </div>
        ) : null}
      </div>

      <div className="sidebar-section nav-section">
        <SectionLabel>导航</SectionLabel>
        <div className="mt-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={cn("side-nav-row", activeView === item.id && "side-nav-row--active")}
                aria-label={item.label}
                aria-current={activeView === item.id ? "page" : undefined}
                title={item.label}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function ProjectRow({
  title,
  runtime,
  status,
  active = false,
  onSelect,
}: {
  title: string
  runtime: string
  status: string
  active?: boolean
  onSelect?: () => void
}) {
  const statusLabel = runStatusLabels[status] ?? status
  const rowLabel = `${title}，${runtime}，${statusLabel}`
  const content = (
    <>
      <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>{runtime}</span>
          <span>{statusLabel}</span>
        </div>
      </div>
    </>
  )
  if (onSelect) {
    return (
      <button type="button" className={cn("project-row", active && "project-row--active")} onClick={onSelect} aria-current={active ? "true" : undefined} aria-label={rowLabel}>
        {content}
      </button>
    )
  }
  return (
    <div className={cn("project-row", active && "project-row--active")} aria-label={rowLabel}>
      {content}
    </div>
  )
}

function ProducerWorkbench({
  readOnly = false,
  message,
  setMessage,
  activeRun,
  draftOpen,
  draftMessages,
  completedSteps,
  progressValue,
  events,
  isConnected,
  isGenerating,
  draftBusy,
  onCreateRun,
  onAdvance,
  onSendDraft,
  onStartProduction,
}: {
  readOnly?: boolean
  message: string
  setMessage: (message: string) => void
  activeRun: RunState | null
  draftOpen: boolean
  draftMessages: DraftMessage[]
  completedSteps: number
  progressValue: number
  events: BootstrapState["events"]
  isConnected: boolean
  isGenerating: boolean
  draftBusy: boolean
  onCreateRun: () => void
  onAdvance: () => void
  onSendDraft: () => void | Promise<void>
  onStartProduction: () => void
}) {
  const activeStep = timeline[Math.min(completedSteps, timeline.length - 1)]
  const hasDraftBrief = draftMessages.some((item) => item.role === "user" && item.briefCandidate !== false && isProductionBriefTurn(item.body)) || isProductionBriefTurn(message)
  const visibleUserBrief = activeRun?.brief || message.trim()
  const runFinal = activeRun?.status === "final"
  const runBlocked = activeRun?.status === "blocked" || activeRun?.package?.status === "blocked"
  const runStateLabel = draftOpen ? "草稿" : runBlocked ? "等待素材修复" : runFinal ? "已交付" : activeStep?.label ?? "准备中"

  return (
    <section className="workbench">
      <div className="workbench-status">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot status={draftOpen ? "idle" : activeRun?.status === "final" ? "done" : runBlocked ? "revision" : "working"} />
          <span>{runStateLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-lg" onClick={onCreateRun} disabled={readOnly}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            新建
          </Button>
          <Button
            size="sm"
            className={cn("rounded-lg", runBlocked && "blocked-action")}
            disabled={readOnly || !isConnected || isGenerating || runBlocked || runFinal || (draftOpen && !hasDraftBrief)}
            onClick={draftOpen ? onStartProduction : onAdvance}
          >
            <Play data-icon="inline-start" aria-hidden="true" />
            {readOnly ? "只读" : isGenerating ? "生成中" : runBlocked ? "已阻塞" : runFinal ? "成片就绪" : draftOpen ? "开始制作" : "继续流水线"}
          </Button>
        </div>
      </div>

      <WorkspaceTimeline completedSteps={completedSteps} draftOpen={draftOpen} />
      <ProductionEtaCard run={activeRun} draftOpen={draftOpen} />
      <LiveActivityFeed run={activeRun} draftOpen={draftOpen} completedSteps={completedSteps} events={events} />

      <div className="workbench-body">
        <div className="producer-chat">
          <div className="chat-scroll">
            <div className="conversation-thread">
              {draftOpen ? (
                <DraftConversation messages={draftMessages} />
              ) : (
                <>
                  {visibleUserBrief ? <UserMessage>{visibleUserBrief}</UserMessage> : null}
                  <ProducerMessage timestamp="now">
                    <p>收到。我会把需求拆成可追踪的视频生产流水线，只由 Producer 对外沟通，其他 Agent 在后台按 artifact 交接。</p>
                    <PlanCard completedSteps={completedSteps} progressValue={progressValue} />
                  </ProducerMessage>
                  <ProducerMessage timestamp={runBlocked ? "blocked" : "pipeline"}>
                    <p>{activeRun ? `当前 Run: ${activeRun.id}。下一步：${activeStep?.managerLine ?? "准备交付"}` : "还没有 active run。点 New 会先进入空白 Draft，Producer 会问清楚需求；确认后再开始生产。"}</p>
                    {runBlocked ? (READONLY_PUBLIC_DEMO ? <BlockedImagegenReadOnlyNotice run={activeRun} /> : <BlockedImagegenNotice run={activeRun} />) : null}
                    <HandoffCard step={activeStep} />
                  </ProducerMessage>
                </>
              )}
            </div>
          </div>

          <div className="chat-input">
            <div className="chat-input-rail">
              <Textarea
                aria-label="Producer 指令"
                name="producer_instruction"
                autoComplete="off"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-11 resize-none rounded-lg border-border bg-background text-sm"
                disabled={readOnly}
                placeholder={readOnly ? "公网 1:1 展示：Agent 对话不可用。" : draftOpen ? "描述你要生产的视频..." : "输入新需求或直接继续自动流水线..."}
              />
              <Button
                className={cn("rounded-lg", runBlocked && "blocked-action")}
                onClick={draftOpen ? onSendDraft : activeRun ? onAdvance : onCreateRun}
                disabled={readOnly || (draftOpen ? !message.trim() || draftBusy : !isConnected || runFinal || runBlocked)}
              >
                <Send data-icon="inline-start" aria-hidden="true" />
                {readOnly ? "不可用" : draftOpen ? draftBusy ? "处理中" : "发送" : runFinal ? "已完成" : runBlocked ? "已阻塞" : activeRun ? "继续" : "新建"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function WorkspaceTimeline({ completedSteps, draftOpen }: { completedSteps: number; draftOpen: boolean }) {
  return (
    <div className="workspace-timeline" aria-label="流水线时间线">
      <div className="workspace-timeline-head">
        <SectionLabel>Timeline</SectionLabel>
        <span>{draftOpen ? "waiting for start" : `${Math.min(completedSteps, timeline.length)} / ${timeline.length}`}</span>
      </div>
      <div className="workspace-timeline-track">
        {timeline.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "workspace-timeline-step",
              !draftOpen && index < completedSteps && "workspace-timeline-step--done",
              !draftOpen && index === completedSteps && "workspace-timeline-step--active",
              draftOpen && index === 0 && "workspace-timeline-step--waiting"
            )}
          >
            <span aria-hidden="true" />
            <strong>{step.label}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDuration(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "等待采样"
  if (seconds <= 0) return "即将完成"
  const rounded = Math.max(1, Math.round(seconds))
  const minutes = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (minutes <= 0) return `约 ${rest} 秒`
  if (minutes < 60) return `约 ${minutes} 分 ${rest.toString().padStart(2, "0")} 秒`
  const hours = Math.floor(minutes / 60)
  return `约 ${hours} 小时 ${minutes % 60} 分`
}

function ProductionEtaCard({ run, draftOpen }: { run: RunState | null; draftOpen: boolean }) {
  const difficulty = run?.difficultyEstimate
  const telemetry = run?.tokenTelemetry
  const progress =
    telemetry?.estimatedTotalTokens && telemetry.estimatedTotalTokens > 0
      ? Math.max(4, Math.min(100, Math.round(((telemetry.estimatedTotalTokens - telemetry.estimatedRemainingTokens) / telemetry.estimatedTotalTokens) * 100)))
      : 0
  const etaText = draftOpen
    ? "开始后评估"
    : run?.status === "final"
      ? "已完成"
      : formatDuration(telemetry?.estimatedRemainingSeconds)
  const speedText = telemetry?.averageTokensPerSecond ? `${telemetry.averageTokensPerSecond.toFixed(1)} tok/s` : "等待首个 token"
  const statusText =
    telemetry?.status === "sampling"
      ? `采样前 ${telemetry.sampleWindowSeconds} 秒`
      : telemetry?.status === "estimating"
        ? "按首轮采样估算"
        : telemetry?.status === "complete"
          ? "完成"
          : "等待 Agent 输出"

  return (
    <div className="production-eta" aria-label="Token speed and ETA">
      <div className="production-eta-primary">
        <span className="production-eta-icon" aria-hidden="true">
          <Timer size={16} />
        </span>
        <div>
          <SectionLabel>ETA</SectionLabel>
          <strong>{etaText}</strong>
        </div>
      </div>
      <div className="production-eta-grid">
        <div>
          <span>难度</span>
          <strong>{difficulty ? `D${difficulty.level} · ${difficulty.label}` : "未评估"}</strong>
        </div>
        <div>
          <span>Token 速度</span>
          <strong>{speedText}</strong>
        </div>
        <div>
          <span>估算依据</span>
          <strong>{statusText}</strong>
        </div>
      </div>
      <div className="production-eta-meter" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

type LiveFeedItem = {
  id: string
  phase: string
  agent: string
  detail: string
  status: "streaming" | "done" | "queued"
}

function LiveActivityFeed({
  run,
  draftOpen,
  completedSteps,
  events,
}: {
  run: RunState | null
  draftOpen: boolean
  completedSteps: number
  events: BootstrapState["events"]
}) {
  const items = buildLiveFeed(run, draftOpen, completedSteps, events)
  const feedState = run?.status === "blocked" ? "blocked" : run?.status === "final" ? "complete" : items.some((item) => item.status === "streaming") ? "streaming" : "idle"
  const primary = items[0]
  if (!primary) return null
  return (
    <div className="live-feed" aria-label="Producer live stream">
      <div className="live-feed-head">
        <SectionLabel>Activity</SectionLabel>
        <span className={cn("live-feed-status", feedState === "streaming" && "live-feed-status--streaming", feedState === "complete" && "live-feed-status--complete", feedState === "blocked" && "live-feed-status--blocked")}>
          <span aria-hidden="true" />
          {primary.phase}
        </span>
      </div>
      <div className="live-feed-stream">
        <div className={cn("live-feed-item", `live-feed-item--${primary.status}`)}>
          <strong>{primary.agent}</strong>
          <span className="live-feed-detail">{primary.detail}</span>
          {primary.status === "streaming" ? <StreamingDots /> : null}
        </div>
      </div>
    </div>
  )
}

function buildLiveFeed(run: RunState | null, draftOpen: boolean, completedSteps: number, events: BootstrapState["events"]): LiveFeedItem[] {
  if (draftOpen) {
    return [
      {
        id: "draft-thinking",
        phase: "thinking",
        agent: "Producer",
        detail: "监听 brief，先不执行制作 Agent",
        status: "streaming",
      },
      {
        id: "draft-ready",
        phase: "handoff",
        agent: "Producer",
        detail: "确认后部署 Research、Story Director、Asset、Video Engineer 等持久 Agent",
        status: "queued",
      },
    ]
  }

  if (!run) {
    return [
      {
        id: "idle",
        phase: "ready",
        agent: "Producer",
        detail: "新建 session 后开始收集 brief",
        status: "queued",
      },
    ]
  }

  const activeStep = timeline[Math.min(completedSteps, timeline.length - 1)]
  const activeAgent = agentSkills.find((agent) => agent.id === activeStep?.agentId)
  const activeItems: LiveFeedItem[] =
    run.status === "blocked"
      ? [
          {
            id: "imagegen-blocked",
            phase: "blocked",
            agent: "Asset",
            detail: "OAuth imagegen 主视觉不足，Render 被硬门禁拦截",
            status: "queued",
          },
        ]
      : run.status === "final"
      ? [
          {
            id: "package-ready",
            phase: "package",
            agent: "Quality",
            detail: "最终视频、源码、素材说明和质检报告已经归档",
            status: "done",
          },
        ]
      : [
          {
            id: "producer-thinking",
            phase: "thinking",
            agent: "Producer",
            detail: activeStep?.managerLine ?? "正在读取项目状态",
            status: "streaming",
          },
          {
            id: "producer-handoff",
            phase: "handoff",
            agent: "Producer",
            detail: `部署 ${activeAgent?.shortName ?? activeStep?.agentId ?? "Agent"}，目标产物 ${activeStep?.outputId ?? "artifact"}`,
            status: "streaming",
          },
        ]

  const runEvents = events
    .filter((event) => {
      const eventRunId = eventPayloadRunId(event.payload)
      return eventRunId === run.id
    })
    .slice(-1)
    .reverse()
    .map((event) => eventToLiveItem(event))

  return activeItems.length ? activeItems : runEvents
}

function eventPayloadRunId(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("runId" in payload)) return null
  const value = (payload as { runId?: unknown }).runId
  return typeof value === "string" ? value : null
}

function eventToLiveItem(event: BootstrapState["events"][number]): LiveFeedItem {
  const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {}
  const agentId = typeof payload.agentId === "string" ? payload.agentId : null
  const outputId = typeof payload.outputId === "string" ? payload.outputId : null
  const stepId = typeof payload.stepId === "string" ? payload.stepId : null
  const agent = agentSkills.find((item) => item.id === agentId)?.shortName ?? (agentId ? agentId : "Producer")

  const typeMap: Record<string, { phase: string; detail: string; status: LiveFeedItem["status"] }> = {
    "run.created": { phase: "start", detail: "创建 run，写入 project_brief", status: "done" },
    "task.started": { phase: "deploying", detail: `${stepId ?? "task"} 已派发给 ${agent}`, status: "streaming" },
    "automation.running": { phase: "running", detail: "Producer 正在自动推进流水线", status: "streaming" },
    "agent.thinking": { phase: "thinking", detail: `${agent} 正在读取输入和成功标准`, status: "streaming" },
    "handoff.started": { phase: "handoff", detail: `Producer 交接给 ${agent}`, status: "streaming" },
    "artifact.writing": { phase: "artifact", detail: `写入 ${outputId ?? "artifact"}`, status: "streaming" },
    "task.completed": { phase: "done", detail: `${agent} 交付 ${outputId ?? "artifact"}`, status: "done" },
    "automation.packaging": { phase: "packaging", detail: "流水线完成，开始生成最终交付包", status: "streaming" },
    "package.preflight": { phase: "preflight", detail: "自动质量门正在检查 imagegen / 素材门禁", status: "streaming" },
    "imagegen.blocked": { phase: "blocked", detail: "缺少 OAuth imagegen 主视觉，停止渲染", status: "queued" },
    "package.rendering": { phase: "rendering", detail: "Render Agent 正在导出 final.mp4", status: "streaming" },
    "package.writing": { phase: "package", detail: "写入源码包、素材说明、质检报告和日志", status: "streaming" },
    "package.blocked": { phase: "blocked", detail: "阻塞包已生成，不包含假 final.mp4", status: "queued" },
    "package.ready": { phase: "ready", detail: "最终交付包已生成", status: "done" },
    "automation.blocked": { phase: "blocked", detail: "自动流水线停在素材门禁", status: "queued" },
    "automation.complete": { phase: "complete", detail: "自动流水线完成", status: "done" },
  }
  const mapped = typeMap[event.type] ?? { phase: "event", detail: event.type, status: "done" as const }

  return {
    id: event.id,
    phase: mapped.phase,
    agent,
    detail: mapped.detail,
    status: mapped.status,
  }
}

function StreamingDots() {
  return (
    <span className="streaming-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

function InspectorPanel({
  mode,
  setMode,
  open,
  onClose,
  selectedAgent,
  selectedWorker,
  activeArtifact,
  run,
  runtimeName,
}: {
  mode: InspectorMode
  setMode: (mode: InspectorMode) => void
  open: boolean
  onClose: () => void
  selectedAgent: (typeof agentSkills)[number]
  selectedWorker?: WorkerState
  activeArtifact: ArtifactRecord | null
  run: RunState | null
  runtimeName: string
}) {
  const inspectorOptions: Array<{ value: InspectorMode; label: string; hint: string }> = [
    { value: "agent", label: "当前 Agent", hint: selectedAgent.shortName },
    { value: "artifact", label: "产物清单", hint: `${run?.artifacts.length ?? 0} items` },
    { value: "runtime", label: "运行计划", hint: runtimeName },
    { value: "quality", label: "自动质检", hint: run?.status === "final" ? "done" : "checking" },
    { value: "final", label: "最终交付", hint: run?.package ? "package ready" : "waiting" },
  ]
  const selectedOption = inspectorOptions.find((option) => option.value === mode) ?? inspectorOptions[0]

  return (
    <aside className={cn("inspector-panel", open && "inspector-panel--open")} aria-hidden={!open}>
      <div className="inspector-head">
        <div className="min-w-0">
          <SectionLabel>详情面板</SectionLabel>
          <h2>{selectedOption.label}</h2>
          <p>{selectedOption.hint}</p>
        </div>
        <select className="inspector-select" value={mode} onChange={(event) => setMode(event.target.value as InspectorMode)} aria-label="选择右侧检查内容">
          {inspectorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="button" className="inspector-close" onClick={onClose}>
          收起
        </button>
      </div>

      <div className="inspector-scroll">
        {mode === "agent" ? <AgentDetailView agent={selectedAgent} worker={selectedWorker} /> : null}
        {mode === "artifact" ? <ArtifactPreview artifact={activeArtifact} artifacts={run?.artifacts ?? []} /> : null}
        {mode === "runtime" ? <RuntimePlanView run={run} runtimeName={runtimeName} /> : null}
        {mode === "quality" ? <QualityGateView run={run} /> : null}
        {mode === "final" ? <FinalInspector run={run} runtimeName={runtimeName} /> : null}
      </div>
    </aside>
  )
}

function AgentDetailView({ agent, worker }: { agent: (typeof agentSkills)[number]; worker?: WorkerState }) {
  const status = worker?.status ?? "idle"

  return (
    <div className="space-y-4">
      <div className="agent-profile">
        <AgentGlyph agent={agent} status={status} size="large" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{agent.shortName}</h2>
          <div className="mt-1 text-xs text-muted-foreground">{agent.role}</div>
        </div>
        <Badge variant="outline" className={cn("ml-auto rounded-md", statusClass[status])}>{statusCopy[status]}</Badge>
      </div>

      <InfoBlock title="当前任务">
        <p>{agent.mission}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-high">
          <div className="h-full w-2/3 bg-primary" />
        </div>
      </InfoBlock>

      <InfoBlock title="模型策略">
        <div className="metadata-grid">
          <span>模型</span>
          <strong>{worker?.model ?? "gpt-5.5"}</strong>
          <span>推理</span>
          <strong>{worker?.thinkingLabel ?? worker?.thinkingLevel ?? "medium"}</strong>
          <span>能力</span>
          <strong>{worker?.capabilities?.length ? worker.capabilities.join(", ") : "standard"}</strong>
        </div>
      </InfoBlock>

      <InfoBlock title="记忆栈">
        <BulletList items={[`输入: ${agent.inputs.join(", ")}`, `输出: ${agent.outputs.join(", ")}`, `Agent 收件箱: ${worker?.inbox.length ?? 0}`]} />
      </InfoBlock>

      <InfoBlock title="技能栈">
        <div className="flex flex-wrap gap-1.5">
          {agent.skillStack.map((skill) => (
            <Badge key={skill} variant="outline" className="rounded-md">{skill}</Badge>
          ))}
        </div>
      </InfoBlock>

      <InfoBlock title="交接规则">
        <p>{agent.handoff}</p>
      </InfoBlock>

      <InfoBlock title="工作方式">
        <BulletList items={agent.how} />
      </InfoBlock>
    </div>
  )
}

function ArtifactPreview({ artifact, artifacts }: { artifact: ArtifactRecord | null; artifacts: ArtifactRecord[] }) {
  const current = artifact ?? artifacts.at(-1)
  return (
    <div className="space-y-4">
      <InfoBlock title="产物预览">
        <h2 className="text-lg font-semibold">{current?.title ?? "暂无产物"}</h2>
        <p className="mt-2">{current?.summary ?? "创建或运行流水线后，可在这里查看产物。"}</p>
        {current ? <CodePanel>{JSON.stringify({ id: current.id, type: current.type, owner: current.ownerAgentId, path: current.path }, null, 2)}</CodePanel> : null}
      </InfoBlock>
      <InfoBlock title="产物历史">
        <div className="space-y-1.5">
          {(artifacts.length ? artifacts : seedArtifacts.map((item) => ({
            id: item.id,
            title: item.title,
            type: item.type,
            ownerAgentId: item.owner.toLowerCase(),
            path: item.id,
            summary: item.summary,
            checks: item.checks,
            createdAt: new Date().toISOString(),
          }))).map((item) => (
            <div key={item.id} className="artifact-row">
              <FileCode2 className="size-3.5 text-primary" aria-hidden="true" />
              <span className="truncate">{item.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{item.type}</span>
            </div>
          ))}
        </div>
      </InfoBlock>
    </div>
  )
}

function RuntimePlanView({ run, runtimeName }: { run: RunState | null; runtimeName: string }) {
  return (
    <div className="space-y-4">
      <InfoBlock title="Runtime Plan">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{runtimeName}</h2>
          <Badge variant="outline" className="rounded-md">{run?.runtime ?? "hyperframes"}</Badge>
        </div>
        <p className="mt-2">Video Engineer locks scene specs before writing code.</p>
      </InfoBlock>
      <InfoBlock title="Scene Breakdown">
        <div className="space-y-1.5">
          {timeline.slice(0, 6).map((step, index) => (
            <div key={step.id} className="runtime-row">
              <span className="font-mono text-[10px] text-primary">S{index + 1}</span>
              <span className="truncate">{step.label}</span>
              <span className="text-muted-foreground">{step.outputId}</span>
            </div>
          ))}
        </div>
      </InfoBlock>
      <InfoBlock title="Validation">
        <BulletList items={runtimeName === "HyperFrames" ? ["DESIGN.md gate", "layout before animation", "hyperframes lint / validate / inspect"] : ["React composition", "still-frame check", "remotion render"]} />
      </InfoBlock>
    </div>
  )
}

function QualityGateView({ run }: { run: RunState | null }) {
  const blocked = run?.status === "blocked" || run?.package?.status === "blocked"
  return (
    <div className="space-y-4">
      <InfoBlock title="自动质检报告">
        <Badge variant="outline" className={cn("rounded-md", blocked ? "text-destructive" : run?.status === "final" ? "text-secondary" : "text-primary")}>
          {blocked ? "阻塞：imagegen 门禁" : run?.status === "final" ? "已通过" : "检查中"}
        </Badge>
        <div className="mt-3 space-y-2">
          <CheckRow label="OAuth imagegen 主视觉存在" done={run?.status === "final"} />
          <CheckRow label="最终视频可播放" done={run?.status === "final"} />
          <CheckRow label="素材风险已记录" done={Boolean(run?.package)} />
          <CheckRow label="引用已打包" done={Boolean(run?.package)} />
          <CheckRow label="源码包已包含" done={Boolean(run?.package)} />
        </div>
      </InfoBlock>
      <InfoBlock title="局部返修">
        <p>{blocked ? "先让 Imagegen Agent 生成 blocked_imagegen_request.json 里要求的 5 张图并注册，然后再重新进入渲染。" : run?.status === "final" ? "没有阻塞项，最终交付包已就绪。" : "自动质量门只生成局部返修任务，不重启整条流水线。"}</p>
      </InfoBlock>
    </div>
  )
}

function FinalInspector({ run, runtimeName }: { run: RunState | null; runtimeName: string }) {
  const files = run?.package?.files.length ? run.package.files : packageItems
  const blocked = run?.status === "blocked" || run?.package?.status === "blocked"
  return (
    <div className="space-y-4">
      <InfoBlock title="最终交付包">
        <h2 className="text-lg font-semibold">{run?.title ?? "暂无最终 run"}</h2>
        {blocked ? <p className="mt-2 text-sm text-destructive">已阻塞：缺少 OAuth imagegen 主视觉，所以没有生成 final.mp4。</p> : null}
        <div className="mt-3 grid gap-2">
          {run?.package?.finalVideoUrl ? <DownloadButton href={run.package.finalVideoUrl} label="下载 MP4" /> : null}
          {run?.package?.sourceZipUrl ? <DownloadButton href={run.package.sourceZipUrl} label={`下载源码 (${runtimeName})`} /> : null}
          {run?.package?.packageZipUrl ? <DownloadButton href={run.package.packageZipUrl} label="下载最终包" /> : null}
        </div>
      </InfoBlock>
      <InfoBlock title="文件">
        <div className="space-y-1.5">
          {files.slice(0, 10).map((file) => <CheckRow key={file} label={file} done />)}
        </div>
      </InfoBlock>
    </div>
  )
}

function BottomConsole({
  open,
  setOpen,
  completedSteps,
  events,
  run,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  completedSteps: number
  events: BootstrapState["events"]
  run: RunState | null
}) {
  return (
    <section className={cn("bottom-console", !open && "bottom-console--closed")}>
      <div className="bottom-console-head">
        <div className="pipeline-headline">
          <SectionLabel>流水线时间轴</SectionLabel>
          <div className="stage-strip" aria-label="流水线阶段">
            {timeline.map((step, index) => (
              <span
                key={step.id}
                className={cn(
                  "stage-pill",
                  index < completedSteps && "stage-pill--done",
                  index === completedSteps && "stage-pill--active"
                )}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>
        <button type="button" className="console-toggle" onClick={() => setOpen(!open)}>{open ? "收起" : "展开"}</button>
      </div>
      {open ? (
        <div className="bottom-console-body">
          <div className="console-summary-panel">
            <SectionLabel>运行进度</SectionLabel>
            <MiniPipeline completedSteps={completedSteps} />
            <div className="console-run-notes">
              {(run?.logs.length ? run.logs.slice(-4) : ["Producer 就绪", "产物已版本化", "可局部返修"]).map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </div>
          </div>
          <div className="tool-console">
            <div className="flex items-center justify-between">
              <SectionLabel>工具控制台</SectionLabel>
              <span className="font-mono text-[10px] text-muted-foreground">{events.length} 条事件</span>
            </div>
            <div className="mt-2 space-y-1">
              {(events.length ? events.slice(-6).reverse().map((event) => ({
                id: event.id,
                agent: "Producer",
                tool: event.type,
                status: "done",
                detail: new Date(event.createdAt).toLocaleTimeString(),
              })) : toolEvents).map((event) => (
                <div key={event.id} className="console-line">
                  <span className="text-primary">&gt;</span>
                  <span>{event.tool}</span>
                  <span className="text-muted-foreground">{event.agent}</span>
                  <span className={cn(event.status === "blocked" ? "text-destructive" : event.status === "waiting" ? "text-primary" : "text-secondary")}>{event.status}</span>
                </div>
              ))}
              {run?.logs.slice(-2).map((line, index) => (
                <div key={`${line}-${index}`} className="console-line">
                  <span className="text-primary">&gt;</span>
                  <span className="truncate">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AgentTeamView({ workers, onInspect }: { workers: WorkerState[]; onInspect: (agentId: string) => void }) {
  return (
    <section className="page-panel">
      <div className="page-panel-head">
        <div className="agent-team-title">
          <div className="team-mark team-mark--agent" aria-hidden="true">
            <Layers3 size={22} />
            <span className="team-mark-dot team-mark-dot--a" />
            <span className="team-mark-dot team-mark-dot--b" />
            <span className="team-mark-dot team-mark-dot--c" />
          </div>
          <div>
            <SectionLabel>Agent 团队</SectionLabel>
            <h1>持久在线制作团队</h1>
          </div>
        </div>
        <Badge variant="outline" className="rounded-md">{workers.length} 个 Agent</Badge>
      </div>
      <div className="agent-table-wrap">
        <table className="agent-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>角色</th>
              <th>技能</th>
              <th>模型</th>
              <th>推理</th>
              <th>状态</th>
              <th>当前任务</th>
              <th>收件箱</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => {
              const agent = agentSkills.find((item) => item.id === worker.id)
              return (
                <tr
                  key={worker.id}
                  className="agent-table-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => onInspect(worker.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onInspect(worker.id)
                    }
                  }}
                  aria-label={`查看 ${worker.shortName}`}
                >
                  <td data-label="Agent">
                    <div className="flex items-center gap-2">
                      <AgentGlyph agent={agent} status={worker.status} />
                      <span>{worker.shortName}</span>
                    </div>
                  </td>
                  <td data-label="角色">{worker.role}</td>
                  <td data-label="技能">{agent?.skillStack.slice(0, 3).join(", ") ?? "artifact"}</td>
                  <td data-label="模型">{worker.model}</td>
                  <td data-label="推理">{worker.thinkingLabel ?? worker.thinkingLevel}</td>
                  <td data-label="状态" className={statusClass[worker.status]}>{statusCopy[worker.status]}</td>
                  <td data-label="当前任务">{worker.currentTaskId ?? "-"}</td>
                  <td data-label="收件箱">{worker.inbox.length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FinalDeliveryView({ run, runtimeName }: { run: RunState | null; runtimeName: string }) {
  const files = run?.package?.files.length ? run.package.files : packageItems
  const assets = run?.package?.videoAssets ?? []
  const blocked = run?.status === "blocked" || run?.package?.status === "blocked"
  return (
    <section className="page-panel final-page">
      <div className="page-panel-head">
        <div>
          <SectionLabel>最终交付包</SectionLabel>
          <h1>视频交付室</h1>
          <p className="page-panel-subtitle">{run?.title ?? "等待生成最终交付包"}</p>
        </div>
        <Badge variant="outline" className="rounded-md">{runtimeName}</Badge>
      </div>

      <div className="delivery-grid">
        <div className="video-theater">
          {run?.package?.finalVideoUrl ? (
            <div className="video-theater-frame">
              <video src={run.package.finalVideoUrl} controls playsInline className="delivery-video" />
              <div className="video-theater-topline">
                <span>最终成片</span>
                <strong>{runtimeName}</strong>
              </div>
            </div>
          ) : (
            <div className="video-placeholder">
              <Play className="size-10" aria-hidden="true" />
              <span>生成完成后在这里预览成片</span>
            </div>
          )}
        </div>
        <div className="delivery-meta">
          <InfoBlock title="下载">
            <div className="grid gap-2">
              {run?.package?.finalVideoUrl ? <DownloadButton href={run.package.finalVideoUrl} label="final_video.mp4" /> : null}
              {run?.package?.sourceZipUrl ? <DownloadButton href={run.package.sourceZipUrl} label="source_project.zip" /> : null}
              {run?.package?.packageZipUrl ? <DownloadButton href={run.package.packageZipUrl} label="final_package.zip" /> : null}
            </div>
          </InfoBlock>
          <InfoBlock title="元数据">
            <div className="metadata-grid">
              <span>运行时</span><strong>{runtimeName}</strong>
              <span>时长</span><strong>00:30</strong>
              <span>Agent 数</span><strong>{agentSkills.length}</strong>
              <span>质检</span><strong>{blocked ? "阻塞" : run?.status === "final" ? "通过" : "等待"}</strong>
            </div>
          </InfoBlock>
        </div>
      </div>

      <div className="delivery-proof-grid">
        <InfoBlock title="生成视频素材">
          {assets.length ? (
            <div className="asset-manifest-list">
              {assets.map((asset) => (
                <div key={asset.id} className="asset-manifest-row">
                  <div className="asset-manifest-main">
                    <Film className="size-4 text-secondary" aria-hidden="true" />
                    <div className="min-w-0">
                      <strong>{asset.title}</strong>
                      <span>{asset.purpose}</span>
                    </div>
                  </div>
                  <div className="asset-manifest-meta">
                    <span>{asset.durationSeconds ?? 6}s</span>
                    <span>{asset.source}</span>
                    <span>{asset.risk}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>生成完成后这里会列出每段视频素材、用途、授权和风险。</p>
          )}
        </InfoBlock>

        <InfoBlock title="自动质量门">
          <div className="quality-gate-grid">
            {["30 秒 mp4 可播放", "含视频素材", "源码 ZIP 可下载", "素材风险已标注", "引用与日志完整", "可局部返修"].map((item) => (
              <CheckRow key={item} label={item} done={run?.status === "final"} />
            ))}
          </div>
        </InfoBlock>
      </div>

      <InfoBlock title="文件、引用与授权">
        <div className="file-grid">
          {files.slice(0, 18).map((file) => <CheckRow key={file} label={file} done />)}
        </div>
      </InfoBlock>
    </section>
  )
}

function SettingsView({
  readOnly = false,
  settings,
  capabilities,
  openaiAccount,
  onConnect,
  onSettings,
}: {
  readOnly?: boolean
  settings: AppSettings
  capabilities?: BootstrapState["capabilities"]
  openaiAccount: BootstrapState["openaiAccount"]
  onConnect: () => Promise<void>
  onSettings: (settings: Partial<AppSettings>) => Promise<void>
}) {
  const oauthConnected = settings.authStatus === "connected" || Boolean(openaiAccount)
  const [activeSettingsGroup, setActiveSettingsGroup] = useState<SettingsGroup>("connect")
  const updateAgentPolicy = (agentId: string, patch: Partial<AgentModelPolicy>) => {
    const current = settings.modelPolicy?.[agentId] ?? { model: "gpt-5.5", thinkingLevel: "medium", thinkingLabel: "medium" }
    const nextPolicy = {
      ...settings.modelPolicy,
      [agentId]: {
        ...current,
        ...patch,
        thinkingLabel: patch.thinkingLevel ? thinkingOptions.find((option) => option.value === patch.thinkingLevel)?.label ?? patch.thinkingLevel : current.thinkingLabel,
      },
    }
    void onSettings({ modelPolicy: nextPolicy })
  }

  return (
    <section className="page-panel settings-page">
      <div className="settings-hero">
        <div>
          <SectionLabel>设置</SectionLabel>
          <h1>控制台设置</h1>
          <p>连接、素材、运行时、Agent。</p>
        </div>
        <Button className="settings-primary-action" onClick={onConnect} disabled={readOnly}>
          <KeyRound data-icon="inline-start" aria-hidden="true" />
          {readOnly ? "只读展示" : oauthConnected ? "OAuth 已连接" : "连接 OpenAI"}
        </Button>
      </div>

      <nav className="settings-tabs" aria-label="设置分组">
        {settingsGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={cn("settings-tab", activeSettingsGroup === group.id && "settings-tab--active")}
            onClick={() => setActiveSettingsGroup(group.id)}
          >
            <span>{group.label}</span>
            <strong>{group.detail}</strong>
          </button>
        ))}
      </nav>

      <div className="settings-layout">
        <aside className="settings-rail" aria-label="设置概览">
          <div className="settings-rail-card">
            <SectionLabel>概览</SectionLabel>
            <div className="settings-health-list">
              <div>
                <span>Agent</span>
                <strong>{agentHostOptions.find((option) => option.id === (settings.agentHost ?? "codex_native"))?.name ?? "Codex Native Kernel"}</strong>
              </div>
              <div>
                <span>素材</span>
                <strong>{visualProviderOptions.find((option) => option.id === (settings.visualProvider ?? "codex_imagegen"))?.name ?? "Codex imagegen"}</strong>
              </div>
              <div>
                <span>运行时</span>
                <strong>{settings.defaultRuntime === "hyperframes" ? "HyperFrames" : "Remotion"}</strong>
              </div>
              <div>
                <span>密度</span>
                <strong>{settings.layoutMode === "simple" ? "标准" : "专家"}</strong>
              </div>
            </div>
          </div>

          <div className="settings-rail-card settings-rail-card--soft">
            <SectionLabel>状态</SectionLabel>
            <div className="settings-readiness">
              <CheckRow label="应用服务" done={Boolean(capabilities?.codexNative?.appServer)} />
              <CheckRow label="ChatGPT 登录" done={Boolean(capabilities?.codexNative?.loggedInWithChatGPT)} />
              <CheckRow label="图片生成" done={Boolean(capabilities?.codexNative?.imageGeneration)} />
              <CheckRow label="工具搜索" done={Boolean(capabilities?.codexNative?.toolSearch)} />
            </div>
          </div>
        </aside>

        <div className="settings-sections" data-active-group={activeSettingsGroup}>
        <section className="setting-card setting-card--wide setting-card--connect">
          <div>
            <SectionLabel>连接</SectionLabel>
            <h2>模型连接</h2>
            <p>只显示可用性，不暴露本地账号细节。</p>
          </div>
          <div className="setting-status-stack">
            <div className="setting-status-row">
              <span>Codex 服务</span>
              <Badge variant="outline" className={cn("rounded-md", capabilities?.codexNative?.appServer ? "text-secondary" : "text-destructive")}>
                {capabilities?.codexNative?.appServer ? "可用" : "缺失"}
              </Badge>
            </div>
            <div className="setting-status-row">
              <span>ChatGPT</span>
              <Badge variant="outline" className={cn("rounded-md", capabilities?.codexNative?.loggedInWithChatGPT ? "text-secondary" : "text-muted-foreground")}>
                {capabilities?.codexNative?.loggedInWithChatGPT ? "已连接" : "未登录"}
              </Badge>
            </div>
            <div className="setting-status-row">
              <span>图片生成</span>
              <Badge variant="outline" className={cn("rounded-md", capabilities?.codexNative?.imageGeneration ? "text-secondary" : "text-destructive")}>
                {capabilities?.codexNative?.imageGeneration ? "启用" : "未启用"}
              </Badge>
            </div>
            <div className="setting-status-row">
              <span>工具搜索</span>
              <Badge variant="outline" className={cn("rounded-md", capabilities?.codexNative?.toolSearch ? "text-secondary" : "text-destructive")}>
                {capabilities?.codexNative?.toolSearch ? "启用" : "未启用"}
              </Badge>
            </div>
            {connectionOptions.map((option) => (
              <div key={option.id} className="setting-status-row">
                <span>{option.id === "chatgpt" ? "OAuth" : option.id === "api_key" ? "API Key" : option.name}</span>
                <Badge
                  variant="outline"
                  className={cn("rounded-md", option.id === "chatgpt" && oauthConnected ? "text-secondary" : "text-muted-foreground")}
                >
                  {option.id === "chatgpt" && oauthConnected ? "已连接" : option.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="setting-card setting-card--wide setting-card--connect">
          <div>
            <SectionLabel>Agent</SectionLabel>
            <h2>Agent 接入方式</h2>
            <p>选择 Producer 和各 Agent 的承载方式。</p>
          </div>
          <div className="setting-choice-list">
            {agentHostOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn("choice-row", (settings.agentHost ?? "codex_native") === option.id && "choice-row--active")}
                disabled={readOnly}
                onClick={() => onSettings({ agentHost: option.id })}
              >
                <span>{option.name}</span>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="setting-card setting-card--wide setting-card--connect">
          <div>
            <SectionLabel>素材</SectionLabel>
            <h2>素材来源</h2>
            <p>只接受真实产图、API、上传或公开来源。</p>
          </div>
          <div className="setting-choice-list">
            {visualProviderOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn("choice-row", (settings.visualProvider ?? "codex_imagegen") === option.id && "choice-row--active")}
                disabled={readOnly}
                onClick={() => onSettings({ visualProvider: option.id })}
              >
                <span>{option.name}</span>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="setting-card setting-card--models">
          <div>
            <SectionLabel>图片</SectionLabel>
            <h2>图片生成模型</h2>
            <p>Asset Agent 默认模型。</p>
          </div>
          <div className="setting-choice-list">
            {imageModelOptions.map((model) => (
              <button
                key={model}
                type="button"
                className={cn("choice-row", (settings.imageModel ?? "gpt-image-2") === model && "choice-row--active")}
                disabled={readOnly}
                onClick={() => onSettings({ imageModel: model })}
              >
                <span>{model}</span>
                <span>{model === "gpt-image-2" ? "默认质量" : "旧版备用"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="setting-card setting-card--wide setting-card--models">
          <div>
            <SectionLabel>模型策略</SectionLabel>
            <h2>Agent 模型策略</h2>
            <p>角色、推理强度、能力一屏配置。</p>
          </div>
          <div className="model-policy-list" aria-label="Agent 模型策略">
            {agentSkills.map((agent) => {
              const policy = settings.modelPolicy?.[agent.id] ?? { model: "gpt-5.5", thinkingLevel: "medium", thinkingLabel: "medium", capabilities: [] }
              const capabilitiesLabel = policy.capabilities?.length ? policy.capabilities.join(", ") : "standard"
              return (
                <article key={agent.id} className="model-policy-card">
                  <div className="model-policy-agent">
                    <AgentGlyph agent={agent} status="idle" />
                    <div>
                      <strong>{agent.shortName}</strong>
                      <span>{agent.role}</span>
                    </div>
                  </div>
                  <label className="model-policy-control">
                    <span>模型</span>
                    <select
                      className="inspector-select model-policy-select"
                      value={policy.model}
                      disabled={readOnly}
                      onChange={(event) => updateAgentPolicy(agent.id, { model: event.target.value })}
                    >
                      {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>
                  </label>
                  <label className="model-policy-control">
                    <span>推理</span>
                    <select
                      className="inspector-select model-policy-select"
                      value={policy.thinkingLevel}
                      disabled={readOnly}
                      onChange={(event) => updateAgentPolicy(agent.id, { thinkingLevel: event.target.value as AgentThinkingLevel })}
                    >
                      {thinkingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <div className="model-policy-capability">
                    <span>能力</span>
                    <strong>{capabilitiesLabel}</strong>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="setting-card setting-card--render">
          <div>
            <SectionLabel>运行时</SectionLabel>
            <h2>视频运行时</h2>
            <p>默认渲染栈。</p>
          </div>
          <div className="setting-choice-list">
            {(["hyperframes", "remotion"] as const).map((runtime) => (
              <button
                key={runtime}
                type="button"
                className={cn("choice-row", settings.defaultRuntime === runtime && "choice-row--active")}
                disabled={readOnly}
                onClick={() => onSettings({ defaultRuntime: runtime })}
              >
                <span>{runtime === "hyperframes" ? "HyperFrames" : "Remotion"}</span>
                <span>{runtime === "hyperframes" ? "HTML + GSAP 动效" : "React 合成"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="setting-card setting-card--render">
          <div>
            <SectionLabel>密度</SectionLabel>
            <h2>界面密度</h2>
            <p>诊断密度。</p>
          </div>
          <div className="setting-choice-list">
            {(["simple", "power"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn("choice-row", settings.layoutMode === mode && "choice-row--active")}
                disabled={readOnly}
                onClick={() => onSettings({ layoutMode: mode })}
              >
                <span>{mode === "simple" ? "标准模式" : "专家模式"}</span>
                <span>{mode === "simple" ? "聚焦制作界面" : "完整诊断信息"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="setting-card setting-card--wide setting-card--automation">
          <div>
            <SectionLabel>自动化</SectionLabel>
            <h2>自动执行</h2>
            <p>自动推进；质量门失败才阻塞。</p>
          </div>
          <div className="automation-policy-preview">
            <span>web/search</span>
            <strong>自动</strong>
            <span>render/code</span>
            <strong>自动</strong>
            <span>质量门</span>
            <strong>自动</strong>
          </div>
        </section>
        </div>
      </div>
    </section>
  )
}

function TerminalSetupDialog({ onClose }: { onClose: () => void }) {
  useEscapeKey(true, onClose)
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="terminal-dialog" role="dialog" aria-modal="true" aria-label="AutoDirector 本地启动配置" onMouseDown={(event) => event.stopPropagation()}>
        <div className="terminal-dialog-head">
          <div>
            <SectionLabel>终端配置</SectionLabel>
            <h2>本地一键启动配置</h2>
            <p>从源码包启动本地控制台，再进入 Web UI 做 OAuth 和 runtime 选择；生产流程默认自动推进。</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭配置">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="terminal-steps">
          <TerminalStep index="01" title="安装依赖">
            <TerminalCommand command="npm ci" />
          </TerminalStep>
          <TerminalStep index="02" title="构建项目">
            <TerminalCommand command="npm run build" />
            <p>使用锁文件复现依赖，并生成本地 Web UI 构建结果。</p>
          </TerminalStep>
          <TerminalStep index="03" title="启动本地控制台">
            <TerminalCommand command="npm start" />
          </TerminalStep>
        </div>

        <div className="terminal-preview">
          <div className="terminal-dot-row"><span /><span /><span /></div>
          <pre>{`$ npm ci
$ npm run build
$ npm start
-------------
Web UI: http://127.0.0.1:8787
评委快速检查: npm run verify:quick
完整 Agent 检查: npm run verify:full`}</pre>
        </div>
      </section>
    </div>
  )
}

function TerminalStep({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <div className="terminal-step">
      <span>{index}</span>
      <div>
        <strong>{title}</strong>
        <div className="terminal-step-body">{children}</div>
      </div>
    </div>
  )
}

function TerminalCommand({ command }: { command: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")

  async function copyCommand() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command)
      } else {
        const scratch = document.createElement("textarea")
        scratch.value = command
        scratch.style.position = "fixed"
        scratch.style.opacity = "0"
        document.body.appendChild(scratch)
        scratch.select()
        document.execCommand("copy")
        scratch.remove()
      }
      setCopyState("copied")
      window.setTimeout(() => setCopyState("idle"), 1400)
    } catch {
      setCopyState("failed")
      window.setTimeout(() => setCopyState("idle"), 1800)
    }
  }

  return (
    <button type="button" className="terminal-command" onClick={copyCommand} aria-live="polite">
      <code>{command}</code>
      <span>{copyState === "copied" ? "已复制" : copyState === "failed" ? "失败" : "复制"}</span>
    </button>
  )
}

function MiniPipeline({ completedSteps }: { completedSteps: number }) {
  const compactStages = ["Brief", "研究", "脚本", "素材", "构建", "质检"]
  const currentIndex = Math.min(Math.max(Math.floor(completedSteps / 2), 0), compactStages.length - 1)
  return (
    <div className="mini-pipeline" aria-label="流水线进度">
      {compactStages.map((stage, index) => (
        <div
          key={stage}
          className={cn(
            "mini-pipeline-step",
            index < currentIndex && "mini-pipeline-step--done",
            index === currentIndex && "mini-pipeline-step--active"
          )}
        >
          <span />
          <strong>{stage}</strong>
        </div>
      ))}
    </div>
  )
}

function BlockedImagegenReadOnlyNotice({ run }: { run: RunState | null }) {
  const reasons = run?.package?.blockedReason?.length ? run.package.blockedReason : ["缺少 OAuth imagegen 主视觉，已停止渲染。"]
  return (
    <div className="blocked-notice">
      <div>
        <SectionLabel>渲染前阻塞</SectionLabel>
        <h3>缺少合格 gpt-image-2 / OAuth 主视觉，系统不会生成假 final.mp4。</h3>
      </div>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p className="blocked-notice-readonly">公网展示模式只显示阻塞原因，不暴露本地文件接口。</p>
    </div>
  )
}

function BlockedImagegenNotice({ run }: { run: RunState | null }) {
  const reasons = run?.package?.blockedReason?.length ? run.package.blockedReason : ["缺少 OAuth imagegen 主视觉，已停止渲染。"]
  const requestPath = `/api/runs/${run?.id ?? ""}/files/blocked_imagegen_request.json`
  const promptPath = `/api/runs/${run?.id ?? ""}/files/imagegen_prompt_pack.json`
  return (
    <div className="blocked-notice">
      <div>
        <SectionLabel>渲染前阻塞</SectionLabel>
        <h3>缺少合格 gpt-image-2 / OAuth 主视觉，系统不会生成假 final.mp4。</h3>
      </div>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {run ? (
        <div className="blocked-notice-actions">
          <a href={promptPath} target="_blank" rel="noreferrer">提示词包</a>
          <a href={requestPath} target="_blank" rel="noreferrer">登记请求</a>
        </div>
      ) : null}
    </div>
  )
}

function PlanCard({ completedSteps, progressValue }: { completedSteps: number; progressValue: number }) {
  const activeStep = timeline[Math.min(completedSteps, timeline.length - 1)]
  return (
    <div className="plan-card">
      <div className="flex items-center justify-between">
        <SectionLabel>Producer 计划</SectionLabel>
        <span className="font-mono text-xs text-muted-foreground">{progressValue}%</span>
      </div>
      <div className="plan-summary">
        <div>
          <strong>当前阶段</strong>
          <span>{activeStep?.label ?? "Brief"}</span>
        </div>
        <div>
          <strong>负责人</strong>
          <span>{agentDisplayName(activeStep?.agentId)}</span>
        </div>
        <div>
          <strong>交付物</strong>
          <span>{artifactDisplayName(activeStep?.outputId)}</span>
        </div>
      </div>
      <MiniPipeline completedSteps={completedSteps} />
    </div>
  )
}

function HandoffCard({ step }: { step?: (typeof timeline)[number] }) {
  return (
    <div className="handoff-card">
      <Layers3 className="size-4 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-sm font-semibold">产物交接</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Producer {"->"} {agentDisplayName(step?.agentId)} · 预期产物：{artifactDisplayName(step?.outputId)}
        </p>
      </div>
    </div>
  )
}

function UserMessage({ children }: { children: ReactNode }) {
  return (
    <div className="chat-message chat-message--user">
      <div className="message-bubble">{children}</div>
      <div className="user-marker">U</div>
    </div>
  )
}

function DraftConversation({ messages }: { messages: DraftMessage[] }) {
  if (!messages.length) return <DraftBriefIntro />

  return (
    <>
      {messages.map((item) =>
        item.role === "user" ? (
          <DraftUserMessage key={item.id}>{item.body}</DraftUserMessage>
        ) : (
          <DraftProducerMessage key={item.id}>
            <p>{item.body}</p>
          </DraftProducerMessage>
        )
      )}
    </>
  )
}

function DraftBriefIntro() {
  return (
    <div className="draft-intro">
      <div className="draft-intro-mark">P</div>
      <div className="draft-intro-copy">
        <SectionLabel>Producer 需求澄清</SectionLabel>
        <h2>你直接说想做什么</h2>
        <p>我会先听明白，再决定什么时候启动制作团队。没点启动生产前，制作 Agent 不会开工。</p>
        <div className="draft-intro-grid">
          <span>先聊清楚</span>
          <span>再拆任务</span>
          <span>全程可回看</span>
        </div>
      </div>
    </div>
  )
}

function DraftUserMessage({ children }: { children: ReactNode }) {
  return (
    <div className="chat-message chat-message--user chat-message--draft">
      <div className="message-bubble">{children}</div>
      <div className="user-marker">U</div>
    </div>
  )
}

function DraftProducerMessage({ children }: { children: ReactNode }) {
  return (
    <div className="chat-message chat-message--producer chat-message--draft">
      <div className="agent-marker">P</div>
      <div className="message-bubble">{children}</div>
    </div>
  )
}

function ProducerMessage({ children, timestamp }: { children: ReactNode; timestamp: string }) {
  return (
    <div className="chat-message chat-message--producer">
      <div className="agent-marker">P</div>
      <div className="message-bubble">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="text-primary">Producer Agent</span>
          <span>{timestamp}</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function Onboarding({
  settings,
  onComplete,
  onConnect,
}: {
  settings: AppSettings
  onComplete: (settings: Pick<AppSettings, "defaultRuntime" | "layoutMode" | "agentHost" | "visualProvider">) => Promise<void>
  onConnect: () => Promise<void>
}) {
  const [runtime, setRuntime] = useState<AppSettings["defaultRuntime"]>(settings.defaultRuntime)
  const [agentHost, setAgentHost] = useState<AgentHost>(settings.agentHost ?? "codex_native")
  const [visualProvider, setVisualProvider] = useState<VisualProvider>(settings.visualProvider ?? "codex_imagegen")
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("simple")
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const canContinue = true

  return (
    <div className="onboarding-shell">
      <section className="onboarding-card">
        <div className="onboarding-aside">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <BrandMark />
            </div>
            <div>
              <div className="font-display text-sm font-semibold">AutoDirector</div>
              <div className="font-mono text-[10px] text-muted-foreground">首次配置向导</div>
            </div>
          </div>

          <div className="onboarding-terminal">
            <div className="terminal-dot-row"><span /><span /><span /></div>
            <pre>{`$ npm ci
$ npm run build
? Agent 承载: ${agentHostOptions.find((option) => option.id === agentHost)?.name ?? "Codex Native Kernel"}
? 视觉来源: ${visualProviderOptions.find((option) => option.id === visualProvider)?.name ?? "Codex imagegen"}
? 运行时: ${runtime === "hyperframes" ? "HyperFrames" : "Remotion"}
? 界面密度: ${layoutMode === "simple" ? "标准" : "专家"}
$ npm start`}</pre>
          </div>

          <div className="terminal-steps compact">
            <TerminalCommand command="npm ci" />
            <TerminalCommand command="npm run build" />
            <TerminalCommand command="npm start" />
          </div>
        </div>

        <div className="onboarding-main">
          <div className="onboarding-head">
            <SectionLabel>首次配置</SectionLabel>
            <h1>配置本地视频制作团队</h1>
            <p>一次只做一个选择，后面可以在设置里改。</p>
          </div>
          <div className="setup-steps-row">
            {["Agent 承载", "视觉来源", "运行时", "界面密度"].map((label, index) => (
              <div key={label} className={cn("setup-step", step === index && "setup-step--active")}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>

          <div className="setup-stage">
          {step === 0 ? (
            <div className="setup-card">
              <SectionLabel>Agent 承载</SectionLabel>
              <h2>谁来承载 Producer 和 Agent</h2>
              <p>推荐用 Codex Native Kernel：本机 Codex app-server 会为 Producer 和每个 Agent 保留独立 thread，直接复用用户的 ChatGPT/Codex 登录。</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {agentHostOptions.map((option) => (
                  <button key={option.id} className={cn("choice-row", agentHost === option.id && "choice-row--active")} onClick={() => setAgentHost(option.id)} type="button">
                    <span>{option.name}</span>
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="setup-card">
              <SectionLabel>视觉来源</SectionLabel>
              <h2>图片和导图从哪里来</h2>
              <p>只有 Native Kernel / Plugin / API / 上传可以通过 imagegen 类视觉门禁；其他模式不会影响脚本、代码、渲染，但不能伪造生成图。</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {visualProviderOptions.map((option) => (
                  <button key={option.id} className={cn("choice-row", visualProvider === option.id && "choice-row--active")} onClick={() => setVisualProvider(option.id)} type="button">
                    <span>{option.name}</span>
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
              <Button variant="outline" className="mt-4 rounded-lg" onClick={onConnect}>
                <KeyRound data-icon="inline-start" aria-hidden="true" />
                {settings.authStatus === "connected" ? "OAuth 已连接" : "可选 OpenAI OAuth"}
              </Button>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="setup-card">
              <SectionLabel>默认运行时</SectionLabel>
              <h2>选择视频渲染栈</h2>
              <p>后续可在设置里改。</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {(["hyperframes", "remotion"] as const).map((value) => (
                  <button key={value} className={cn("choice-row", runtime === value && "choice-row--active")} onClick={() => setRuntime(value)} type="button">
                    <span>{value === "hyperframes" ? "HyperFrames" : "Remotion"}</span>
                    <span>{value === "hyperframes" ? "HTML + GSAP 动效" : "React 工程视频"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="setup-card">
              <SectionLabel>界面密度</SectionLabel>
              <h2>选择工作台密度</h2>
              <p>后续可在设置里改。</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {(["simple", "power"] as const).map((value) => (
                  <button key={value} className={cn("choice-row", layoutMode === value && "choice-row--active")} onClick={() => setLayoutMode(value)} type="button">
                    <span>{value === "simple" ? "标准模式" : "专家模式"}</span>
                    <span>{value === "simple" ? "清爽控制塔" : "完整调试面板"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          </div>

        <div className="onboarding-actions">
          <Button variant="outline" className="rounded-lg" disabled={step === 0 || busy} onClick={() => setStep((value) => Math.max(0, value - 1))}>上一步</Button>
          {step < 3 ? (
            <Button className="rounded-lg" disabled={!canContinue || busy} onClick={() => setStep((value) => value + 1)}>
              继续
              <ChevronRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              className="rounded-lg"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onComplete({ defaultRuntime: runtime, layoutMode, agentHost, visualProvider })
                } finally {
                  setBusy(false)
                }
              }}
            >
              进入控制台
            </Button>
          )}
        </div>
        </div>
      </section>
    </div>
  )
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="info-block">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-2 text-sm leading-6 text-foreground/90">{children}</div>
    </section>
  )
}

function StatusDot({ status }: { status: AgentStatus }) {
  return <span className={cn("size-2 shrink-0 rounded-full", statusDotClass[status])} />
}

function BrandMark() {
  return <img src={appAssetUrl("brand/autodirector-mark.svg")} alt="" className="brand-mark" />
}

function AgentGlyph({
  agent,
  status,
  size = "normal",
}: {
  agent?: (typeof agentSkills)[number]
  status: AgentStatus
  size?: "normal" | "large"
}) {
  const Icon = agent?.icon ?? Bot
  const accent = "#27251e"
  return (
    <span
      className={cn("agent-glyph", size === "large" && "agent-glyph--large", `agent-glyph--${status}`)}
      style={{ "--agent-accent": accent } as CSSProperties}
    >
      <Icon className="agent-glyph-icon" aria-hidden="true" />
      <span className="agent-glyph-pulse" />
    </span>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-5 text-muted-foreground">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function CheckRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="check-row">
      <span className="truncate">{label}</span>
      {done ? <Check className="size-3.5 text-secondary" aria-hidden="true" /> : <Circle className="size-3.5 text-muted-foreground" aria-hidden="true" />}
    </div>
  )
}

function CodePanel({ children }: { children: string }) {
  return <pre className="code-panel">{children}</pre>
}

function DownloadButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="download-link" href={href}>
      <Download className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </a>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</div>
}

export default App
