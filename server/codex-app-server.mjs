import { spawn, spawnSync } from "node:child_process"

export function codexBinary() {
  return process.env.AUTODIRECTOR_CODEX_BIN || "codex"
}

export function redactSecret(value) {
  return String(value ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/g, "Bearer [redacted]")
    .replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/g, '"refresh_token":"[redacted]"')
    .replace(/"id_token"\s*:\s*"[^"]+"/g, '"id_token":"[redacted]"')
}

export function codexNativeStatus() {
  const cached = codexStatusCache && Date.now() - codexStatusCacheAt < 30_000 ? codexStatusCache : null
  if (cached) return { ...cached }
  const bin = codexBinary()
  const version = spawnSync(bin, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 2_000 })
  if (version.status !== 0) {
    const unavailable = {
      available: false,
      binary: bin,
      version: null,
      login: "unavailable",
      loggedInWithChatGPT: false,
      imageGeneration: false,
      toolSearch: false,
      appServer: false,
      error: redactSecret(version.stderr || version.stdout || version.error?.message || `${bin} not found`),
    }
    setCodexStatusCache(unavailable)
    return unavailable
  }

  const base = {
    available: true,
    binary: bin,
    version: String(version.stdout || version.stderr || "").trim(),
    login: codexStatusCache?.login ?? "checking",
    loggedInWithChatGPT: Boolean(codexStatusCache?.loggedInWithChatGPT),
    imageGeneration: Boolean(codexStatusCache?.imageGeneration),
    toolSearch: Boolean(codexStatusCache?.toolSearch),
    appServer: Boolean(codexStatusCache?.appServer),
    running: false,
  }
  if (!codexStatusRefreshPromise) {
    codexStatusRefreshPromise = refreshCodexNativeStatus(bin, base).finally(() => {
      codexStatusRefreshPromise = null
    })
  }
  return codexStatusCache ? { ...codexStatusCache, version: base.version } : base
}

let codexStatusCache = null
let codexStatusCacheAt = 0
let codexStatusRefreshPromise = null

function setCodexStatusCache(value) {
  codexStatusCache = value
  codexStatusCacheAt = Date.now()
}

function runProbe(command, args, timeoutMs = 3_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        child.kill("SIGKILL")
      } catch {
        // best-effort
      }
      resolve({ status: null, stdout, stderr, timedOut: true })
    }, timeoutMs)
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("exit", (status) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ status, stdout, stderr, timedOut: false })
    })
    child.on("error", (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ status: null, stdout, stderr: error.message, timedOut: false })
    })
  })
}

async function refreshCodexNativeStatus(bin, base) {
  const [help, login, features] = await Promise.all([
    runProbe(bin, ["app-server", "--help"], 3_000),
    runProbe(bin, ["login", "status"], 3_000),
    runProbe(bin, ["features", "list"], 3_000),
  ])
  const featureText = `${features.stdout ?? ""}\n${features.stderr ?? ""}`
  const next = {
    ...base,
    login: String(login.stdout || login.stderr || (login.timedOut ? "login status timed out" : "")).trim(),
    loggedInWithChatGPT: /Logged in using ChatGPT/i.test(`${login.stdout}\n${login.stderr}`),
    imageGeneration: /image_generation\s+\S+\s+true/i.test(featureText),
    toolSearch: /tool_search\s+\S+\s+true/i.test(featureText),
    appServer: help.status === 0,
    error: [help.timedOut ? "app-server help timed out" : "", login.timedOut ? "login status timed out" : "", features.timedOut ? "features list timed out" : ""].filter(Boolean).join("; ") || undefined,
  }
  setCodexStatusCache(next)
  return next
}

export class CodexAppServerClient {
  constructor(options = {}) {
    this.binary = options.binary || codexBinary()
    this.cwd = options.cwd || process.cwd()
    this.env = options.env || process.env
    this.proc = null
    this.initialized = false
    this.readyPromise = null
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Set()
    this.stdoutBuffer = ""
    this.stderrLines = []
    this.closedError = null
  }

  status() {
    return {
      running: Boolean(this.proc && !this.proc.killed && this.proc.exitCode === null),
      initialized: this.initialized,
      binary: this.binary,
      stderrTail: this.stderrTail(),
    }
  }

  stderrTail(limit = 40) {
    return this.stderrLines.slice(-limit).join("\n")
  }

  async start() {
    if (this.readyPromise) return this.readyPromise
    this.readyPromise = this.#start()
    return this.readyPromise
  }

  async #start() {
    if (this.proc && this.proc.exitCode === null && this.initialized) return this
    this.closedError = null
    this.proc = spawn(
      this.binary,
      [
        "app-server",
        "-c",
        "analytics.enabled=false",
        "--listen",
        "stdio://",
        "--enable",
        "image_generation",
        "--enable",
        "tool_search",
        "--enable",
        "plugins",
      ],
      {
        cwd: this.cwd,
        env: this.env,
        stdio: ["pipe", "pipe", "pipe"],
      }
    )

    this.proc.stdout.setEncoding("utf8")
    this.proc.stderr.setEncoding("utf8")
    this.proc.stdout.on("data", (chunk) => this.#handleStdout(chunk))
    this.proc.stderr.on("data", (chunk) => {
      for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) this.stderrLines.push(line)
      if (this.stderrLines.length > 500) this.stderrLines = this.stderrLines.slice(-500)
    })
    this.proc.on("exit", (code, signal) => {
      const error = new Error(`Codex app-server exited (${code ?? signal ?? "unknown"})`)
      this.closedError = error
      this.initialized = false
      this.readyPromise = null
      for (const pending of this.pending.values()) pending.reject(error)
      this.pending.clear()
    })

    await this.request("initialize", {
      clientInfo: {
        name: "autodirector",
        title: "AutoDirector",
        version: "0.1.0",
      },
      capabilities: { experimentalApi: true },
    })
    this.notify("initialized", {})
    this.initialized = true
    return this
  }

  async request(method, params = {}, timeoutMs = 120_000) {
    await this.#ensureProcess()
    const id = this.nextId++
    const payload = { id, method, params }
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex app-server request timed out: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer, method })
      this.#write(payload)
    })
  }

  notify(method, params = {}) {
    if (!this.proc?.stdin) throw new Error("Codex app-server is not running")
    this.#write({ method, params })
  }

  addNotificationListener(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async #ensureProcess() {
    if (this.closedError) throw this.closedError
    if (!this.proc?.stdin) throw new Error("Codex app-server is not running")
  }

  #write(payload) {
    if (!this.proc?.stdin) throw new Error("Codex app-server is not running")
    this.proc.stdin.write(`${JSON.stringify(payload)}\n`)
  }

  #handleStdout(chunk) {
    this.stdoutBuffer += String(chunk)
    const lines = this.stdoutBuffer.split(/\r?\n/)
    this.stdoutBuffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      let message
      try {
        message = JSON.parse(line)
      } catch {
        this.stderrLines.push(`non-json stdout: ${line.slice(0, 300)}`)
        continue
      }
      this.#handleMessage(message)
    }
  }

  #handleMessage(message) {
    if (message && typeof message === "object" && "id" in message && "method" in message) {
      this.#handleServerRequest(message)
      return
    }
    if (message && typeof message === "object" && "id" in message) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) {
        const error = new Error(String(message.error.message ?? `${pending.method} failed`))
        error.data = message.error.data
        error.code = message.error.code
        pending.reject(error)
      } else {
        pending.resolve(message.result)
      }
      return
    }
    if (message && typeof message === "object" && typeof message.method === "string") {
      for (const listener of [...this.listeners]) listener(message)
    }
  }

  #handleServerRequest(message) {
    const result =
      message.method === "item/commandExecution/requestApproval" || message.method === "item/fileChange/requestApproval"
        ? { decision: "accept" }
        : {}
    this.#write({ id: message.id, result })
  }

  close() {
    if (!this.proc) return
    const proc = this.proc
    this.proc = null
    this.initialized = false
    this.readyPromise = null
    try {
      proc.stdin?.end()
      proc.kill("SIGTERM")
    } catch {
      // best-effort shutdown
    }
  }
}

let singleton = null

export async function getCodexAppServerClient(options = {}) {
  if (!singleton) singleton = new CodexAppServerClient(options)
  await singleton.start()
  return singleton
}

export function getCodexAppServerRuntimeStatus() {
  return singleton?.status() ?? { running: false, initialized: false, stderrTail: "" }
}
