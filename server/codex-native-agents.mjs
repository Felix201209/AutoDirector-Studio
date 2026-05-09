import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { getCodexAppServerClient, getCodexAppServerRuntimeStatus, redactSecret } from "./codex-app-server.mjs"

const artifactOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "type", "summary", "content", "checks", "status"],
  properties: {
    title: { type: "string", maxLength: 80 },
    type: { type: "string", maxLength: 24 },
    summary: { type: "string", maxLength: 420 },
    content: { type: "string", maxLength: 6000 },
    checks: { type: "array", maxItems: 8, items: { type: "string", maxLength: 220 } },
    status: { type: "string", enum: ["done", "blocked"] },
  },
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function writeJsonLine(filePath, value) {
  ensureDir(dirname(filePath))
  appendFileSync(filePath, `${JSON.stringify(value)}\n`)
}

function codexSessionRoot(context) {
  return context.codexSessionDir ?? join(context.codexWorkDir ?? context.rootDir, ".autodirector-codex-sessions")
}

function producerSessionDir(context) {
  return join(codexSessionRoot(context), "producer-chat")
}

function agentSessionDir(context, run, task, worker) {
  return join(codexSessionRoot(context), "runs", run.id, worker.id, task.id)
}

function normalizeNativeEffort(value) {
  const effort = String(value ?? "medium").toLowerCase()
  if (["none", "minimal", "low", "medium", "high", "xhigh"].includes(effort)) return effort
  if (effort === "extra high" || effort === "extra-high") return "xhigh"
  return "medium"
}

function resolveNativeRuntimeModel(model) {
  const value = String(model ?? "").trim()
  if (!value || value.startsWith("codex-") || value === "local-tool-runner" || value === "deterministic-recorder") {
    return process.env.AUTODIRECTOR_CODEX_MODEL || null
  }
  return value
}

function parseJsonFromText(text) {
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

function collectSkillBrief(paths = []) {
  return paths
    .filter(Boolean)
    .map((filePath) => {
      try {
        const body = readFileSync(filePath, "utf8").slice(0, 2600)
        return `## ${filePath}\n${body}`
      } catch {
        return `## ${filePath}\n(unreadable)`
      }
    })
    .join("\n\n")
}

function threadIdFromResponse(response) {
  return response?.thread?.id ?? response?.threadId ?? response?.id ?? null
}

function turnIdFromResponse(response) {
  return response?.turn?.id ?? response?.turnId ?? response?.id ?? null
}

function nativeBaseInstructions() {
  return [
    "你是 AutoDirector 原生 Codex 内核中的持久 Agent。",
    "你不是一次性命令；你拥有自己的 thread 上下文。请把上游 artifact、用户偏好、返修要求保留在长期工作记忆里。",
    "所有协作只通过 artifact 交接：读取上游 artifact，产出当前 artifact，不要替下游 Agent 抢活。",
    "不要自动触发 Codex 全局 skills；只允许使用 developerInstructions 中 Relevant skills 明确列出的 AutoDirector 技能文件。",
    "除非任务明确要求实现代码或渲染，不要读取通用 brainstorming / planning / web-app / UI skills。",
    "禁止伪造 imagegen：非直接新闻/公开素材图必须使用原生 image_generation / imagegen 工具生成文件，不能用 HTML、SVG、canvas、本地 diagram 或占位图冒充。",
    "禁止把成片做成动态 PPT：每个视频任务必须追求真实视频感，包含不同视觉时刻、明确镜头语言、转场、字幕板、音频线索和可验证素材。",
    "HyperFrames 任务必须先 DESIGN.md / SCRIPT.md / STORYBOARD.md，再 layout-before-animation，再 lint/validate/inspect；缺任一硬证据就 blocked。",
    "如果缺工具、缺账号、缺素材、无法确认事实或生成图失败，返回 status=blocked，并写清楚 required_tools / blocked_reason。",
    "回复必须遵守本 turn 的输出要求；需要 JSON 时只输出 JSON。",
  ].join("\n")
}

function producerDeveloperInstructions(context) {
  return [
    context.producerSystemInstructions(),
    "你当前运行在 Codex app-server 持久 thread 里。你可以保留对话上下文，但不要模板化回复。",
    "用户没有点 Start production 前，只做 intake 和澄清；点了之后由 AutoDirector server 调度 Agent。",
  ].join("\n\n")
}

function workerDeveloperInstructions(context, run, task, worker) {
  const skillPaths = context.skillPathsForAgent(task.agentId)
  const skills = collectSkillBrief(skillPaths)
  return [
    `Agent: ${worker.shortName}`,
    `Role: ${worker.role}`,
    `Model policy: ${worker.model}, reasoning=${worker.thinkingLabel ?? worker.thinkingLevel}`,
    skills ? `Relevant skills:\n${skills}` : "Relevant skills: none registered",
    "Skill boundary: ignore all global Codex skills unless their full path appears above in Relevant skills.",
    task.agentId === "asset"
      ? [
          "Asset Agent extra rule:",
          "- 真实新闻人物/事件素材：优先用 web/tool_search 找可引用的真实公开来源，并记录 URL、用途、风险。",
          "- 概念导图、结构图、解释图、风格化视觉：必须调用原生 image_generation/imagegen 生成 PNG。",
          "- 普通 20-30s 视频至少需要 5 个彼此不同且强相关的主视觉或真实素材；不能只给 1-2 张图，其余交给 HTML 卡片。",
          "- 如果主题是真实人物或机构冲突，不要 imagegen 假肖像；用真实可引用图片做证据，用 imagegen 做结构图/时间线/关系图。",
          "- 生成图必须落在 AUTODIRECTOR_IMAGEGEN_DIR 或 prompt 指定目录，并在 content.imagegen_assets 里列文件名。",
        ].join("\n")
      : "",
    task.agentId === "director"
      ? [
          "Story Director extra rule:",
          "- 你同时负责脚本、字幕、分镜、转场和 motion intent。必须给 Video Engineer 可执行的 DESIGN/STORYBOARD 方向，不能只写旁白或静态卡片。",
          "- 如果有旁白，必须产出 voice_screen_map 或等价 timing contract：每句旁白绑定字幕和屏幕事件。",
          "- 如果用户批评排版/格式/图片不好看，必须产出 visual_composition_plan，先定 frame hierarchy 再定动画。",
        ].join("\n")
      : "",
    task.agentId === "programmer"
      ? [
          "Video Engineer extra rule:",
          "- HyperFrames 是默认高质路线。必须创建 DESIGN.md、SCRIPT.md、STORYBOARD.md、index.html、hyperframes.json、assets、compositions、validation，并运行 lint/validate/inspect；失败就 blocked。",
          "- 对 TTS 视频，必须用最终音频的 VTT/voice_screen_map 驱动字幕和视觉事件，不能按草稿脚本估时间。",
          "- 对排版返修，必须按 visual_composition_plan 实现，不要再做一套重复卡片模板。",
        ].join("\n")
      : "",
    task.agentId === "quality"
      ? [
          "Quality Gate extra rule:",
          "- 如果 asset_manifest 没有真实来源图或原生 imagegen 文件，或最终视频像动态 PPT、视觉重复、素材少于 5 个、缺 HyperFrames lint/inspect，必须 status=blocked。",
          "- 如果旁白、字幕、画面事件不同步，或没有 voice_screen_map/VTT/sync_quality 证据，必须 blocked。",
          "- 如果 TTS 质量被用户批评后仍无 audition notes、最终音频来源或重录证据，必须 blocked。",
          "- 如果 contact sheet 看起来还是重复卡片堆或没有清楚主视觉，必须 blocked。",
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

function artifactFromAnswer(answer, task, context) {
  const parsed = parseJsonFromText(answer)
  const template = context.artifactTemplates[task.outputId] ?? [task.outputId, "json", "Agent artifact."]
  if (parsed && typeof parsed === "object") {
    const content = typeof parsed.content === "string" ? parsed.content : JSON.stringify(parsed.content ?? "")
    const checks = Array.isArray(parsed.checks) ? parsed.checks.filter((item) => String(item ?? "").trim()) : []
    const emptyArtifact = !String(content ?? "").trim() && checks.length === 0
    return {
      title: parsed.title ?? template[0],
      type: parsed.type ?? template[1],
      summary: parsed.summary ?? template[2],
      content: content || answer,
      checks: checks.length ? checks : ["native codex artifact generated", "handoff ready"],
      status: parsed.status === "blocked" || emptyArtifact ? "blocked" : "done",
    }
  }
  const fallbackText = String(answer ?? "").trim()
  return {
    title: template[0],
    type: template[1],
    summary: fallbackText.slice(0, 220) || template[2],
    content: fallbackText || template[2],
    checks: fallbackText ? ["native codex artifact generated", "handoff ready"] : ["native codex returned empty text"],
    status: fallbackText ? "done" : "blocked",
  }
}

export function createCodexNativeAgentRuntime(context) {
  function state() {
    return context.getState()
  }

  function ensureNativeState() {
    const current = state()
    const workspaceDir = context.codexWorkDir ?? context.rootDir
    current.codexNative = {
      producerThreadId: null,
      threads: {},
      ...(current.codexNative ?? {}),
    }
    if (current.codexNative.workspaceDir && current.codexNative.workspaceDir !== workspaceDir) {
      current.codexNative.producerThreadId = null
      current.codexNative.threads = {}
    }
    current.codexNative.workspaceDir = workspaceDir
    return current.codexNative
  }

  function codexCwd() {
    const cwd = context.codexWorkDir ?? context.rootDir
    ensureDir(cwd)
    return cwd
  }

  async function appServer() {
    return await getCodexAppServerClient({
      cwd: codexCwd(),
      env: process.env,
      binary: context.codexBinary(),
    })
  }

  async function startThread(params) {
    const client = await appServer()
    const response = await client.request("thread/start", {
      cwd: codexCwd(),
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      config: {
        model_reasoning_effort: params.effort,
        features: {
          image_generation: true,
          tool_search: true,
          plugins: true,
        },
      },
      ...params,
    })
    const threadId = threadIdFromResponse(response)
    if (!threadId) throw new Error("Codex app-server did not return thread id")
    return { threadId, response }
  }

  async function resumeThread(threadId, params = {}) {
    const client = await appServer()
    return await client.request("thread/resume", {
      threadId,
      cwd: codexCwd(),
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      ...params,
    })
  }

  async function getOrCreateProducerThread() {
    const native = ensureNativeState()
    const policy = state().settings.modelPolicy?.producer ?? context.agentModelPolicy.producer
    const model = String(policy.model || "codex-default")
    const runtimeModel = resolveNativeRuntimeModel(model)
    const effort = normalizeNativeEffort(policy.thinkingLevel)
    if (native.producerThreadId) {
      try {
        await resumeThread(native.producerThreadId, { ...(runtimeModel ? { model: runtimeModel } : {}), config: { model_reasoning_effort: effort } })
        return { threadId: native.producerThreadId, model, effort, created: false }
      } catch {
        native.producerThreadId = null
      }
    }

    const { threadId } = await startThread({
      ...(runtimeModel ? { model: runtimeModel } : {}),
      effort,
      baseInstructions: nativeBaseInstructions(),
      developerInstructions: producerDeveloperInstructions(context),
      serviceName: "AutoDirector Producer",
    })
    native.producerThreadId = threadId
    context.saveState()
    return { threadId, model, effort, created: true }
  }

  async function getOrCreateAgentThread(run, task, worker) {
    run.codexThreads = run.codexThreads ?? {}
    const policy = state().settings.modelPolicy?.[worker.id] ?? context.agentModelPolicy[worker.id] ?? context.agentModelPolicy.producer
    const model = String(policy.model ?? worker.model ?? "codex-default")
    const runtimeModel = resolveNativeRuntimeModel(model)
    const effort = normalizeNativeEffort(policy.thinkingLevel ?? worker.thinkingLevel)
    const existing = run.codexThreads[worker.id]
    if (existing?.workspaceDir && existing.workspaceDir !== codexCwd()) {
      delete run.codexThreads[worker.id]
    } else if (existing?.threadId) {
      try {
        await resumeThread(existing.threadId, { ...(runtimeModel ? { model: runtimeModel } : {}), config: { model_reasoning_effort: effort } })
        return { threadId: existing.threadId, model, effort, created: false }
      } catch {
        delete run.codexThreads[worker.id]
      }
    }

    const { threadId } = await startThread({
      ...(runtimeModel ? { model: runtimeModel } : {}),
      effort,
      baseInstructions: nativeBaseInstructions(),
      developerInstructions: workerDeveloperInstructions(context, run, task, worker),
      serviceName: `AutoDirector ${worker.shortName}`,
    })
    run.codexThreads[worker.id] = {
      threadId,
      model,
      thinkingLevel: effort,
      workspaceDir: codexCwd(),
      createdAt: new Date().toISOString(),
      lastTurnId: null,
    }
    context.saveState()
    return { threadId, model, effort, created: true }
  }

  async function runCodexTurn({ threadId, input, params = {}, eventLogPath, timeoutMs = 300_000, onDelta }) {
    const client = await appServer()
    ensureDir(dirname(eventLogPath))
    let turnId = null
    let finalText = ""
    const chunks = []
    const generatedImages = []
    const startedAt = new Date().toISOString()
    let cleanup = () => {}
    let timer = null
    const completion = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Codex native turn timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      cleanup = client.addNotificationListener((message) => {
        const p = message.params ?? {}
        if (p.threadId !== threadId) return
        if (turnId && p.turnId && p.turnId !== turnId) return
        writeJsonLine(eventLogPath, { ts: new Date().toISOString(), method: message.method, params: p })
        if (message.method === "item/agentMessage/delta" && typeof p.delta === "string") {
          chunks.push(p.delta)
          onDelta?.(p.delta)
          return
        }
        if (
          message.method === "item/completed" &&
          p.item?.type === "imageGeneration"
        ) {
          generatedImages.push({
            id: p.item.id,
            status: p.item.status,
            savedPath: p.item.savedPath ?? null,
            revisedPrompt: p.item.revisedPrompt ?? null,
          })
          return
        }
        if (
          message.method === "item/completed" &&
          p.item?.type === "agentMessage" &&
          typeof p.item.text === "string" &&
          (!p.item.phase || p.item.phase === "final_answer")
        ) {
          finalText = p.item.text
          return
        }
        if (message.method === "turn/completed" && (!turnId || p.turn?.id === turnId)) {
          clearTimeout(timer)
          cleanup()
          if (p.turn?.status === "failed") {
            reject(new Error(p.turn?.error?.message ?? "Codex native turn failed"))
          } else {
            resolve({
              turnId: p.turn?.id ?? turnId,
              text: (finalText || chunks.join("")).trim(),
              generatedImages,
              startedAt,
              completedAt: new Date().toISOString(),
              rawTurn: p.turn,
            })
          }
        }
      })
    })

    try {
      const response = await client.request("turn/start", {
        threadId,
        input: [{ type: "text", text: input }],
        cwd: codexCwd(),
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
        ...params,
      })
      turnId = turnIdFromResponse(response)
      writeJsonLine(eventLogPath, { ts: new Date().toISOString(), method: "turn/start", params: { threadId, turnId } })
    } catch (error) {
      cleanup()
      if (timer) clearTimeout(timer)
      throw error
    }
    return await completion
  }

  function requiredNativeImageCount(run) {
    return /数据|对比|速度|汽车|增长|排名|快|慢/i.test(run.brief ?? "") ? 6 : 5
  }

  function nativeImagePaths(run, imageAssetDir) {
    const count = requiredNativeImageCount(run)
    const files = []
    for (let index = 1; index <= count; index += 1) {
      const filePath = join(imageAssetDir, `scene-${index}.png`)
      if (existsSync(filePath)) files.push(filePath)
    }
    return files
  }

  async function ensureNativeImagegenAssets({ run, task, worker, threadId, model, effort, imageAssetDir, outputDir }) {
    if (task.agentId !== "asset") return []
    const existing = nativeImagePaths(run, imageAssetDir)
    const count = requiredNativeImageCount(run)
    if (existing.length >= count) return existing

    const imageLogPath = join(outputDir, "native-imagegen.events.jsonl")
    const generated = [...existing]
    const brief = String(run.brief ?? "").slice(0, 900)
    for (let index = existing.length + 1; index <= count; index += 1) {
      const target = join(imageAssetDir, `scene-${index}.png`)
      const sceneIntent = [
        "opening hook visual: immediately communicate the exact user topic, not AutoDirector itself unless the brief is about AutoDirector",
        "evidence/source visual: source-like collage, webpage/photo frames, or factual context without readable fake text",
        "relationship/process visual: show the main entities, forces, pipeline, timeline, or causal mechanism",
        "conflict/comparison visual: clear two-sided composition, tension, bars, lanes, or opposing forces",
        "resolution/delivery visual: final takeaway, packaged outcome, or what changed",
        "data/comparison board: animated-ready clean structure with subject zones and value lanes",
      ][index - 1] ?? "topic-specific supporting visual"
      const prompt = [
        `AutoDirector Asset/Imagegen preflight for run ${run.id}.`,
        `You are still the persistent ${worker.shortName} Agent thread. This is not the final artifact turn.`,
        "Use the native image_generation/imagegen capability now. Do not only write a prompt pack.",
        `Generate exactly one 9:16 PNG hero visual and save/copy it to this exact absolute path: ${target}`,
        `User brief/topic: ${brief}`,
        `Scene intent: ${sceneIntent}`,
        "Visual style: bright premium editorial explainer, crisp subject, clean depth, high contrast but not dark, smoky green-gray/teal/yellow accents if no other style is specified, no purple AI gradient, no dark room, no generic dashboard.",
        "Composition: center hero must fill the frame with a topic-specific subject. Leave calm safe zones for top title and lower caption. No readable text, no fake UI labels, no logos, no watermark, no tool labels.",
        "If the topic involves real public figures or current news, do not invent identity-preserving portraits. Use neutral diagrams, silhouettes, source frames, timeline objects, legal/news evidence motifs, or abstract relationship visuals.",
        "After the image is generated, use shell only to verify/copy the generated file to the target if needed. Then reply with a compact JSON containing target and status.",
      ].filter(Boolean).join("\n")
      const turn = await runCodexTurn({
        threadId,
        input: prompt,
        eventLogPath: imageLogPath,
        timeoutMs: Number(process.env.AUTODIRECTOR_IMAGEGEN_TIMEOUT_MS ?? 8 * 60_000),
        params: { model, effort },
        onDelta: (delta) => context.recordTokenSample?.(run.id, {
          agentId: worker.id,
          taskId: task.id,
          text: delta,
          source: "codex_native_imagegen_delta",
        }),
      })
      const saved = turn.generatedImages?.map((item) => item.savedPath).filter(Boolean).at(-1)
      if (!existsSync(target) && saved && existsSync(saved)) {
        copyFileSync(saved, target)
      }
      if (existsSync(target)) {
        generated.push(target)
        context.pushEvent?.("imagegen.native_asset_ready", { runId: run.id, agentId: "asset", outputId: `scene_${index}_image`, file: target })
      } else {
        context.pushEvent?.("imagegen.native_asset_missing", { runId: run.id, agentId: "asset", outputId: `scene_${index}_image`, savedPath: saved ?? null })
        break
      }
    }
    return nativeImagePaths(run, imageAssetDir)
  }

  async function runProducerTurn(body = {}, options = {}) {
    const text = String(body.text ?? "").trim()
    if (!text) {
      const error = new Error("message_required")
      error.status = 400
      throw error
    }
    const { threadId, model, effort } = await getOrCreateProducerThread()
    const outputDir = producerSessionDir(context)
    ensureDir(outputDir)
    const eventLogPath = join(outputDir, `${Date.now()}.events.jsonl`)
    const history = Array.isArray(body.messages)
      ? body.messages
          .slice(-8)
          .map((item) => `${item.role === "producer" ? "Producer" : "User"}: ${String(item.body ?? "")}`)
          .join("\n")
      : ""
    const input = [
      "Producer intake turn.",
      `当前时间：${new Date().toISOString()}`,
      history ? `最近 UI 对话摘要：\n${history}` : "",
      `用户最新消息：${text}`,
      "自然回复。不要模板化，不要复读，不要假装已经派发 Agent。最多 2-4 句。",
    ]
      .filter(Boolean)
      .join("\n\n")
    const turn = await runCodexTurn({
      threadId,
      input,
      eventLogPath,
      timeoutMs: Number(process.env.AUTODIRECTOR_PRODUCER_CODEX_TIMEOUT_MS ?? 180_000),
      params: { model, effort },
      onDelta: options.onDelta,
    })
    if (!turn.text) {
      const error = new Error("Codex Native Producer 返回了空消息。")
      error.status = 502
      throw error
    }
    return {
      message: {
        id: `producer_${Date.now()}`,
        role: "producer",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        body: turn.text,
        model,
        thinkingLevel: effort,
        source: "codex_native_app_server",
      },
      nativeTurn: {
        threadId,
        turnId: turn.turnId,
        eventLogPath,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
      },
    }
  }

  async function runAgentTurn(run, task, worker) {
    const { threadId, model, effort } = await getOrCreateAgentThread(run, task, worker)
    const outputDir = agentSessionDir(context, run, task, worker)
    ensureDir(outputDir)
    const eventLogPath = join(outputDir, "events.jsonl")
    const promptPath = join(outputDir, "prompt.md")
    const imageAssetDir = join(context.rootDir, "output", "imagegen", run.id)
    ensureDir(imageAssetDir)
    const preflightImages = await ensureNativeImagegenAssets({ run, task, worker, threadId, model, effort, imageAssetDir, outputDir })
    const instructions = context.agentTaskInstructions(run, task, worker)
    const prompt = [
      `你是 AutoDirector 持久 Agent：${worker.shortName}。`,
      "只完成当前 step，最终返回严格 JSON artifact。",
      "artifact.content 必须是详细字符串；如果内容本身是结构化数据，把它序列化成 JSON 字符串放进 content。",
      "产物要短而密：title <= 80 字符，summary <= 420 字符，content <= 6000 字符，checks 最多 8 条。",
      "不要复写完整上游 artifact；只提炼本步骤需要的约束、决定、风险和交接。",
      "只读取 prompt 里列出的 upstreamArtifacts.path；禁止扫描 .autodirector/state.json、旧 run 目录、全局历史产物或无关文件。",
      "禁止读取未列在 Relevant skills 中的全局 Codex skill 文件；不要执行通用 brainstorming/planning 工作流。",
      "如果 upstreamArtifacts 已提供 contentPreview，优先直接使用它，不要为了同一内容再运行 shell。",
      "你可以使用 Codex 原生工具、tool_search、文件读写、渲染/检查命令，以及 image_generation。",
      "需要生成图片时，必须用原生 image_generation/imagegen，把 PNG 放入 AUTODIRECTOR_IMAGEGEN_DIR。",
      `AUTODIRECTOR_IMAGEGEN_DIR=${imageAssetDir}`,
      task.agentId === "asset" && preflightImages.length
        ? `NATIVE_IMAGEGEN_PREFLIGHT_READY=${preflightImages.length}/${requiredNativeImageCount(run)}\n${preflightImages.map((filePath, index) => `scene-${index + 1}: ${filePath}`).join("\n")}`
        : "",
      "如果无法完成，返回 status=blocked；不要提交空泛或假 artifact。",
      JSON.stringify({
        currentDate: new Date().toISOString(),
        runId: run.id,
        taskId: task.id,
        requiredArtifact: task.outputId,
        instructions,
      }, null, 2),
    ].join("\n\n")
    writeFileSync(promptPath, prompt)
    const turn = await runCodexTurn({
      threadId,
      input: prompt,
      eventLogPath,
      timeoutMs: Number(process.env.AUTODIRECTOR_CODEX_TIMEOUT_MS ?? 15 * 60_000),
      params: {
        model,
        effort,
        outputSchema: artifactOutputSchema,
      },
      onDelta: (delta) => context.recordTokenSample?.(run.id, {
        agentId: worker.id,
        taskId: task.id,
        text: delta,
        source: "codex_native_delta",
      }),
    })
    run.codexThreads[worker.id] = {
      ...(run.codexThreads[worker.id] ?? {}),
      threadId,
      model,
      thinkingLevel: effort,
      lastTurnId: turn.turnId,
      lastActiveAt: turn.completedAt,
    }
    task.nativeTurn = {
      threadId,
      turnId: turn.turnId,
      eventLogPath,
      promptPath,
      startedAt: turn.startedAt,
      completedAt: turn.completedAt,
    }
    context.saveState()
    const artifact = artifactFromAnswer(turn.text, task, context)
    const finalImagePaths = nativeImagePaths(run, imageAssetDir)
    if (task.agentId === "asset" && finalImagePaths.length >= requiredNativeImageCount(run)) {
      artifact.checks = [
        ...(artifact.checks ?? []),
        `native image_generation PNG files verified: ${finalImagePaths.length}/${requiredNativeImageCount(run)}`,
      ].slice(0, 8)
    }
    artifact.content = {
      ...(typeof artifact.content === "object" && artifact.content !== null && !Array.isArray(artifact.content) ? artifact.content : { value: artifact.content }),
      ...(task.agentId === "asset" && finalImagePaths.length
        ? {
            imagegen_assets: {
              provider: "oauth_agent_imagegen_artifact",
              model: context.getState().settings?.imageModel ?? "gpt-image-2",
              assetDir: imageAssetDir,
              files: finalImagePaths,
            },
          }
        : {}),
      native_codex: {
        threadId,
        turnId: turn.turnId,
        model,
        reasoningEffort: effort,
        promptPath,
        eventLogPath,
      },
    }
    return artifact
  }

  return {
    status: getCodexAppServerRuntimeStatus,
    runProducerTurn,
    runAgentTurn,
  }
}
