import { existsSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"

const output = "autodirector-code.zip"
if (existsSync(output)) rmSync(output)

const result = spawnSync(
  "zip",
  [
    "-qr",
    output,
    ".",
    "-x",
    "node_modules/*",
    ".autodirector/*",
    ".autodirector.backup-*/*",
    ".agents/*",
    "dist/*",
    "intro-site/*",
    "output/*",
    "scripts/archive/*",
    ".tmp/*",
    ".playwright-mcp/*",
    ".playwright-cli/*",
    ".DS_Store",
    "*/.DS_Store",
    "__pycache__/*",
    "*/__pycache__/*",
    "*.pyc",
    "*.pyo",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
    "*.pem",
    "*.key",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.webp",
    "*.mp4",
    "*.mov",
    "*.mp3",
    "*.wav",
    "*.aiff",
    "*.ogg",
    "*.m4a",
    "*.zip",
    "*.log",
    "autodirector-*-snapshot.md",
    "intro-site/assets/autodirector-code.zip",
    "intro-site/assets/autodirector-source.zip",
    "intro-site/assets/final-package.zip",
    ".git/*",
    "autodirector-code.zip",
  ],
  { encoding: "utf8" }
)

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "zip failed")
}

const zipinfo = spawnSync("zipinfo", ["-1", output], { encoding: "utf8" })
if (zipinfo.status !== 0) {
  throw new Error(zipinfo.stderr || zipinfo.stdout || "zipinfo failed")
}

const legacyEntryToken = (...parts) => parts.join("")
const legacyEntryNames = [
  legacyEntryToken("q", "a"),
  legacyEntryToken("re", "view"),
  legacyEntryToken("ap", "proval"),
  legacyEntryToken("ac", "ceptance"),
]

const forbiddenEntryPatterns = [
  /(^|\/)__pycache__\//,
  /\.py[co]$/,
  /(^|\/)\.DS_Store$/,
  /^node_modules\//,
  /^\.autodirector\//,
  /^dist\//,
  /^intro-site\//,
  /^scripts\/archive\//,
  /\.(png|jpe?g|webp|gif|mp4|mov|mp3|wav|aiff|ogg|m4a)$/i,
  /\.zip$/i,
  /\.log$/i,
  new RegExp(`(^|/)(${legacyEntryNames.join("|")})([-_./]|$)`, "i"),
  new RegExp(`(^|/)[^/]*(_${legacyEntryNames[0]}|_${legacyEntryNames[1]})([-_.]|$)`, "i"),
]

for (const entry of zipinfo.stdout.split(/\r?\n/)) {
  if (!entry) continue
  const pattern = forbiddenEntryPatterns.find((candidate) => candidate.test(entry))
  if (pattern) throw new Error(`${output} contains forbidden entry ${entry}`)
}

console.log(`Created ${output}`)
