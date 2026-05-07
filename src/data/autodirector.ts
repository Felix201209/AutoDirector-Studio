import {
  BadgeCheck,
  Clapperboard,
  Code2,
  FileSearch,
  Film,
  Image,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  Video,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type RuntimeId = "remotion" | "hyperframes" | "auto"
export type AgentStatus = "idle" | "queued" | "working" | "done" | "revision"
export type ProjectStage =
  | "draft"
  | "researching"
  | "scripting"
  | "directing"
  | "building"
  | "rendering"
  | "checking"
  | "final"

export type AgentSkill = {
  id: string
  name: string
  shortName: string
  role: string
  icon: LucideIcon
  mission: string
  skillStack: string[]
  how: string[]
  inputs: string[]
  outputs: string[]
  doneWhen: string[]
  handoff: string
}

export type Artifact = {
  id: string
  title: string
  owner: string
  type: string
  summary: string
  checks: string[]
}

export type TimelineStep = {
  id: string
  stage: ProjectStage
  label: string
  agentId: string
  outputId: string
  managerLine: string
}

export const runtimePacks = [
  {
    id: "auto" as RuntimeId,
    name: "自动选择",
    tone: "Producer 根据视频类型、风格和素材风险选择最稳 runtime。",
    bestFor: "黑客松现场演示、普通用户默认路径",
  },
  {
    id: "remotion" as RuntimeId,
    name: "Remotion",
    tone: "React 工程模式，偏稳定、模板化、长期维护。",
    bestFor: "产品介绍、数据图表、参数化短视频、可复用源码",
  },
  {
    id: "hyperframes" as RuntimeId,
    name: "HyperFrames",
    tone: "HTML + GSAP 视觉模式，偏强动效、字幕、标题卡。",
    bestFor: "冲击力短片、旁白字幕、节奏感强的社媒内容",
  },
]

export const agentSkills: AgentSkill[] = [
  {
    id: "producer",
    name: "Producer Agent",
    shortName: "Producer",
    role: "管理员 / 制片人",
    icon: UserRoundCog,
    mission: "只和用户对接，把模糊需求拆成可执行任务图，并指定成功标准。",
    skillStack: ["任务拆解", "质量门设计", "顺序调度", "Patch Loop", "本地音乐策略"],
    how: [
      "读取用户主题、时长、平台、风格和素材限制。",
      "如果用户要用本地网易云音乐，记录 .ncm 路径、权限风险和不能随机选歌的规则。",
      "决定流水线顺序、Agent 权限、返修门槛和 runtime 候选。",
      "每次只派发一个明确任务，并在产物达标后交给下游。",
    ],
    inputs: ["project_brief", "user_message"],
    outputs: ["task_graph", "success_criteria", "runtime_decision"],
    doneWhen: ["任务图覆盖完整视频生产链路", "每个任务都有自动质量门", "失败时能定位到具体返修责任人"],
    handoff: "把项目切到 Research Agent；偏好、事实和选题在同一份研究包里收束。",
  },
  {
    id: "research",
    name: "Research Agent",
    shortName: "Research",
    role: "研究与选题",
    icon: Search,
    mission: "把用户偏好、事实研究和选题角度收束成一个可制作的研究包。",
    skillStack: ["偏好抽取", "Browser Use", "来源分级", "事实核查", "标题钩子", "引用清单"],
    how: [
      "先抽取受众、平台、画幅、风格和素材边界，避免后续 Agent 猜。",
      "围绕主题查找可信来源，不把未经验证的卖点写进脚本。",
      "提炼 5 到 8 条可视觉化事实，并给出推荐标题、开场钩子和叙事角度。",
      "标注争议、日期敏感、版权或引用风险。",
    ],
    inputs: ["project_brief"],
    outputs: ["research_pack", "user_preferences", "topic_scorecard"],
    doneWhen: ["偏好约束明确", "每条关键事实有来源", "推荐角度有评分依据", "风险项被显式标记"],
    handoff: "交给 Story Director，直接写成可拍、可剪、可实现的脚本和分镜。",
  },
  {
    id: "director",
    name: "Story Director",
    shortName: "Director",
    role: "脚本 / 字幕 / 导演 / 动效",
    icon: Clapperboard,
    mission: "把研究包一次性变成脚本、字幕、分镜、转场、动效和 HyperFrames 视觉方向。",
    skillStack: ["旁白节奏", "字幕短句", "镜头语言", "画面层级", "转场设计", "HyperFrames Storyboard"],
    how: [
      "把视频拆成 5 个以上不同视觉时刻，每段有旁白、字幕、镜头目的和素材需求。",
      "为每个场景定义 title/hero/caption 分区、scene format、转场和 motion intent。",
      "先给 DESIGN/STORYBOARD 方向，不让 Video Engineer 在最后凭感觉补救。",
    ],
    inputs: ["research_pack", "task_graph"],
    outputs: ["script", "caption_styleguide", "director_brief", "shotlist", "motion_board"],
    doneWhen: ["脚本可读", "每个镜头有用途", "转场和节奏明确", "素材需求足够具体", "拒绝 PPT 卡片化"],
    handoff: "交给 Asset Agent 找真实/imagegen 主视觉和音乐，再交给 Video Engineer 实现。",
  },
  {
    id: "asset",
    name: "Asset Agent",
    shortName: "Asset",
    role: "素材与音乐",
    icon: Image,
    mission: "为每个镜头准备视觉素材、生成图、音乐和音效，并说明它们为什么存在。",
    skillStack: ["素材搜索", "OpenAI imagegen", "ncm-to-mp3", "音乐挑选", "SFX 标注", "版权风险"],
    how: [
      "按分镜找图、视频、图标或可生成素材。",
      "本地网易云曲库先 dry-run 和转换 manifest，再根据 metadata/试听选择，不从文件夹里随机拿歌。",
      "每个素材标注来源、授权风险、镜头用途和替代方案。",
      "发现高风险素材时主动建议用 imagegen 生成图、抽象视觉或可商用替代素材。",
      "给 Render 明确音乐 mood、hit points、ducking 和无版权 fallback。",
    ],
    inputs: ["shotlist", "director_brief", "motion_board"],
    outputs: ["asset_manifest", "imagegen_prompt_pack", "sound_plan"],
    doneWhen: ["每个镜头至少一个素材方案", "声音策略明确", "风险清楚", "替代方案可执行"],
    handoff: "交给 Video Engineer，用素材清单和导演稿生成运行时计划并实现。",
  },
  {
    id: "programmer",
    name: "Video Engineer",
    shortName: "Programmer",
    role: "HyperFrames / Remotion 规划与编程",
    icon: Code2,
    mission: "先锁 runtime_plan，再写真正可运行、可 inspect、可渲染的视频工程。",
    skillStack: ["HyperFrames CLI", "DESIGN.md", "STORYBOARD.md", "GSAP Transitions", "Asset Placement", "Audio Hooks", "NCM audio path"],
    how: [
      "HyperFrames 路径必须包含 DESIGN.md、SCRIPT.md、STORYBOARD.md、index.html、hyperframes.json 和 validation logs。",
      "先布局再动画，每个场景有不同构图、主视觉、转场、字幕板和音频 cue。",
      "音乐只从 sound_plan 接入；本地网易云音乐只能用 ncm-to-mp3 manifest 里的 converted outputPath。",
      "运行 lint、validate/doctor、inspect；失败就阻塞，不能交模板视频。",
    ],
    inputs: ["shotlist", "asset_manifest", "script", "motion_board", "sound_plan"],
    outputs: ["runtime_plan", "source_project", "build_notes", "validation_logs"],
    doneWhen: ["源码结构完整", "场景和分镜一致", "HyperFrames 检查有证据", "没有 PPT 式模板"],
    handoff: "交给 Render Agent 运行预览、截图和导出。",
  },
  {
    id: "render",
    name: "Render Agent",
    shortName: "Render",
    role: "渲染工程",
    icon: Film,
    mission: "运行项目、导出视频、记录错误和可复现日志。",
    skillStack: ["关键帧截图", "音频混音", "ncm-to-mp3 manifest", "ffmpeg fallback", "Render Logs"],
    how: [
      "安装依赖并执行 runtime 对应检查命令。",
      "本地网易云音乐只接转换后的文件，并把 manifest、ffprobe 和选择证据写进 render_report。",
      "渲染单帧或关键帧截图，检查音频轨和字幕安全区，再导出最终 mp4。",
      "失败时生成最小错误报告，交回具体责任 Agent。",
    ],
    inputs: ["source_project", "build_notes", "asset_manifest"],
    outputs: ["render_report", "final_video", "mix_report"],
    doneWhen: ["视频可播放", "日志可复现", "错误被定位到具体阶段"],
    handoff: "交给 Quality Gate 做自动成片检查。",
  },
  {
    id: "quality",
    name: "Quality Gate",
    shortName: "Quality",
    role: "自动质检",
    icon: ShieldCheck,
    mission: "按成功标准自动检查成片，不合格就只返修具体问题。",
    skillStack: ["字幕检查", "画面检查", "节奏检查", "音频检查", "NCM 证据审计"],
    how: [
      "检查时长、字幕遮挡、转场节奏、音乐音量、事实一致性、素材风险和平台规格。",
      "如果用了本地网易云，检查 ncm-to-mp3 manifest、转换后路径、metadata/试听记录和非随机选择理由。",
      "把问题写成 patch_task，指定责任 Agent 和通过条件。",
      "通过后生成最终交付清单。",
    ],
    inputs: ["final_video", "success_criteria", "artifact_index"],
    outputs: ["quality_report", "patch_tasks", "final_package"],
    doneWhen: ["所有硬性标准通过", "返修任务可局部执行", "最终包完整"],
    handoff: "交给 Producer 向用户交付视频、源码、素材说明和质检报告。",
  },
]

export const artifacts: Artifact[] = [
  {
    id: "task_graph",
    title: "任务图与成功标准",
    owner: "Producer",
    type: "json",
    summary: "9 段流水线、2 个质量门、1 个 patch loop，默认 30 秒产品介绍视频。",
    checks: ["每个 Agent 有输入输出", "返修不重跑全链路", "最终包结构固定"],
  },
  {
    id: "user_preferences",
    title: "用户偏好画像",
    owner: "Research",
    type: "json",
    summary: "受众为评委和早期用户，语气专业但不僵硬，平台优先网页展示和 16:9。",
    checks: ["时长 30s", "节奏中高", "避免版权不明素材"],
  },
  {
    id: "research_pack",
    title: "资料包",
    owner: "Research",
    type: "json",
    summary: "整理产品价值、黑客松要求、多 Agent 团队表达和素材风险。",
    checks: ["来源可追溯", "事实风险已标注", "视觉线索可用"],
  },
  {
    id: "topic_scorecard",
    title: "选题评分",
    owner: "Research",
    type: "json",
    summary: "推荐角度：把 GPT/Codex 能力组织成一支可自动验证的视频制作公司。",
    checks: ["传播性 9/10", "制作难度 6/10", "主题贴合 10/10"],
  },
  {
    id: "script",
    title: "旁白与字幕脚本",
    owner: "Director",
    type: "md",
    summary: "开场指出痛点，中段展示 Agent 分工，结尾交付视频和质检报告。",
    checks: ["5 个节拍", "字幕短句", "总时长 28-32s"],
  },
  {
    id: "shotlist",
    title: "导演分镜",
    owner: "Director",
    type: "json",
    summary: "5 个镜头：Brief、Team、Artifacts、Runtime、Final Package。",
    checks: ["每镜头有目的", "有转场说明", "素材需求明确"],
  },
  {
    id: "caption_styleguide",
    title: "字幕样式规范",
    owner: "Director",
    type: "json",
    summary: "定义字幕安全区、字号、分行、强调词和遮挡检查规则。",
    checks: ["每秒字数可读", "不遮挡主体", "静音观看可理解"],
  },
  {
    id: "motion_board",
    title: "转场与动效板",
    owner: "Director",
    type: "json",
    summary: "为每个镜头定义进入、停留、退出、easing 和节奏曲线。",
    checks: ["转场明确", "运动不抢字幕", "节拍和时长匹配"],
  },
  {
    id: "asset_manifest",
    title: "素材清单",
    owner: "Asset",
    type: "json",
    summary: "每个素材绑定镜头，包含用途、来源、风险和替代生成方案。",
    checks: ["无裸版权素材", "每镜头有替代", "风险说明完整"],
  },
  {
    id: "sound_plan",
    title: "音乐与音效计划",
    owner: "Asset",
    type: "json",
    summary: "定义音乐 mood、BPM、hit points、SFX、淡入淡出和授权来源。",
    checks: ["音乐来源清楚", "旁白优先", "节拍点可渲染"],
  },
  {
    id: "runtime_plan",
    title: "Runtime Plan",
    owner: "Programmer",
    type: "json",
    summary: "默认 Remotion 稳定输出，HyperFrames 作为视觉增强路径。",
    checks: ["scene_specs 完整", "检查命令明确", "编程边界锁定"],
  },
  {
    id: "render_report",
    title: "渲染报告",
    owner: "Render",
    type: "log",
    summary: "关键帧检查通过，最终视频可播放，导出包路径已记录。",
    checks: ["单帧检查", "渲染成功", "日志可复现"],
  },
  {
    id: "quality_report",
    title: "自动质检报告",
    owner: "Quality",
    type: "md",
    summary: "字幕、时长、素材、事实、平台规格通过；一处动效节奏建议已生成 patch。",
    checks: ["硬性标准通过", "patch task 可执行", "最终包完整"],
  },
]

export const timeline: TimelineStep[] = [
  {
    id: "brief",
    stage: "draft",
    label: "用户 Brief",
    agentId: "producer",
    outputId: "task_graph",
    managerLine: "我先把你的需求拆成可审计的视频生产任务。",
  },
  {
    id: "research",
    stage: "researching",
    label: "研究选题",
    agentId: "research",
    outputId: "research_pack",
    managerLine: "Research，把偏好、事实、来源和叙事角度收进同一份研究包。",
  },
  {
    id: "script",
    stage: "scripting",
    label: "脚本字幕",
    agentId: "director",
    outputId: "script",
    managerLine: "Director，先把研究包写成可拍的旁白、字幕和节奏。",
  },
  {
    id: "director",
    stage: "directing",
    label: "导演动效",
    agentId: "director",
    outputId: "shotlist",
    managerLine: "Director，现在把脚本变成镜头、节奏、转场和动效规则。",
  },
  {
    id: "asset",
    stage: "directing",
    label: "素材音乐",
    agentId: "asset",
    outputId: "asset_manifest",
    managerLine: "Asset，每个素材和声音都要说清楚用在哪一镜和风险是什么。",
  },
  {
    id: "runtime",
    stage: "building",
    label: "运行时计划",
    agentId: "programmer",
    outputId: "runtime_plan",
    managerLine: "Programmer，先锁 HyperFrames/Remotion 技术计划，再开始写工程。",
  },
  {
    id: "programmer",
    stage: "building",
    label: "视频编程",
    agentId: "programmer",
    outputId: "source_project",
    managerLine: "Programmer，只按 runtime_plan 实现，不擅自改导演方案。",
  },
  {
    id: "render",
    stage: "rendering",
    label: "渲染导出",
    agentId: "render",
    outputId: "render_report",
    managerLine: "Render，先关键帧检查，再导出最终视频。",
  },
  {
    id: "quality",
    stage: "checking",
    label: "自动质检",
    agentId: "quality",
    outputId: "quality_report",
    managerLine: "Quality Gate，按成功标准自动检查，不合格就发局部 patch。",
  },
]

export const stageLabels: Record<ProjectStage, string> = {
  draft: "草案",
  researching: "研究",
  scripting: "脚本",
  directing: "导演",
  building: "构建",
  rendering: "渲染",
  checking: "质检",
  final: "交付",
}

export const packageItems = [
  "final.mp4",
  "judging_readme.md",
  "source_project.zip",
  "asset_manifest.json",
  "runtime_plan.json",
  "caption_styleguide.json",
  "motion_board.json",
  "sound_plan.json",
  "music_manifest.json",
  "imagegen_prompt_pack.json",
  "research_pack.json",
  "topic_scorecard.json",
  "agent_interactions.md",
  "script.md",
  "shotlist.json",
  "citations.md",
  "quality_report.md",
  "run_log.jsonl",
]

export const demoBrief = {
  topic: "AutoDirector：多 Agent 视频制作团队",
  audience: "EasyClaw 黑客松评委",
  platform: "Web 展示 / 16:9",
  duration: "30 秒",
  style: "克制的玻璃质感、工程感、可审计",
  guardrail: "所有素材必须标注用途和风险",
}

export const dashboardStats = [
  { label: "持久 Agent", value: "7", icon: Sparkles },
  { label: "正式 Artifacts", value: "17", icon: FileSearch },
  { label: "Runtime Packs", value: "2", icon: Code2 },
  { label: "质量门", value: "2", icon: BadgeCheck },
]

export const productClaims = [
  {
    title: "用户只找管理员",
    body: "所有沟通都进 Producer，后续分配、催办、返修由管理员调度。",
    icon: Megaphone,
  },
  {
    title: "Agent 不是一次性工具",
    body: "每个 Agent 有 skill、状态、产物、交接标准和历史记录。",
    icon: UserRoundCog,
  },
  {
    title: "稳定优先",
    body: "artifact schema、runtime plan、自动质量门让生成过程可控可复现。",
    icon: ShieldCheck,
  },
]

export const sessions = [
  {
    id: "s1",
    title: "EasyClaw 30 秒产品介绍",
    source: "Web",
    model: "GPT / Codex 默认",
    messages: 18,
    toolCalls: 42,
    updated: "刚刚",
  },
  {
    id: "s2",
    title: "科普解释短片模板",
    source: "Demo Replay",
    model: "HyperFrames Pack",
    messages: 11,
    toolCalls: 27,
    updated: "12 分钟前",
  },
  {
    id: "s3",
    title: "产品发布视频",
    source: "Remotion",
    model: "Remotion Pack",
    messages: 24,
    toolCalls: 61,
    updated: "昨天",
  },
]

export const toolEvents = [
  {
    id: "tool-1",
    agent: "Research",
    tool: "web.search",
    status: "done",
    detail: "收集黑客松规则、竞品 Agent UI、视频生成约束",
  },
  {
    id: "tool-2",
    agent: "Asset",
    tool: "asset.manifest.write",
    status: "done",
    detail: "为 5 个镜头绑定素材用途和授权风险",
  },
  {
    id: "tool-3",
    agent: "Programmer",
    tool: "runtime.plan",
    status: "waiting",
    detail: "等待 Producer 确认 Remotion / HyperFrames",
  },
  {
    id: "tool-4",
    agent: "Quality",
    tool: "quality.patch.create",
    status: "blocked",
    detail: "字幕拥挤时只返修 Director + Programmer",
  },
]

export const connectionOptions = [
  {
    id: "chatgpt",
    name: "OpenAI / Codex OAuth",
    status: "推荐",
    body: "产品默认连接入口。按 Codex CLI OAuth + PKCE 连接用户账号，refresh token 只保存在本地状态目录。",
  },
  {
    id: "api",
    name: "OpenAI API Key",
    status: "备用",
    body: "适合后端稳定跑任务。费用走用户自己的 API 项目，不等于 ChatGPT 订阅额度。",
  },
  {
    id: "demo",
    name: "Demo Replay",
    status: "评审",
    body: "黑客松现场最稳路径：完整展示多 Agent 流水线和最终包，不依赖现场模型波动。",
  },
]

export const workspaceFiles = [
  { name: "brief.json", type: "Input", owner: "Producer" },
  { name: "skills/producer.md", type: "Skill", owner: "Producer" },
  { name: "skills/imagegen.md", type: "Skill", owner: "Asset" },
  { name: "skills/ncm-to-mp3", type: "Skill", owner: "Asset / Render" },
  { name: "motion_board.json", type: "Artifact", owner: "Director" },
  { name: "sound_plan.json", type: "Artifact", owner: "Asset" },
  { name: "ncm_conversion_manifest.json", type: "Artifact", owner: "Asset / Render" },
  { name: "runtime_plan.json", type: "Artifact", owner: "Programmer" },
  { name: "source_project/", type: "Code", owner: "Programmer" },
  { name: "final.mp4", type: "Video", owner: "Render" },
  { name: "quality_report.md", type: "Report", owner: "Quality" },
]

export const platformFeatures = [
  { label: "Chat Gateway", icon: Megaphone },
  { label: "Skills Manager", icon: Wrench },
  { label: "Live Tool Trace", icon: FileSearch },
  { label: "Video Delivery", icon: Video },
]
