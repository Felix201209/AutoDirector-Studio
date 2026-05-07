import { spawn } from "node:child_process"

const processes = [
  spawn("node", ["server/index.mjs"], {
    stdio: "inherit",
    env: { ...process.env, PORT: process.env.PORT ?? "8787" },
  }),
  spawn("npx", ["vite", "--host", "127.0.0.1"], {
    stdio: "inherit",
    env: { ...process.env, AUTODIRECTOR_API_ORIGIN: "http://127.0.0.1:8787" },
  }),
]

function shutdown(signal) {
  for (const child of processes) child.kill(signal)
  process.exit(signal === "SIGINT" ? 0 : 1)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) shutdown("SIGTERM")
  })
}
