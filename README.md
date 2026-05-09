# AutoDirector

AutoDirector is a local-first multi-agent video production control room for the EasyClaw AI Agent Hackathon.

It turns a short video brief into a traceable production pipeline: Producer, Research, Story Director, Asset, Video Engineer, Render, and Quality Gate agents hand off structured artifacts until a packaged video delivery is ready. A Recorder sidecar captures run memory and reusable skill drafts.

Review-use license: this repository is public for hackathon evaluation, but it is not an open-source template. See `LICENSE` before copying, redistributing, or reusing it.

## What To Review

- `src/` - React control room UI.
- `server/` - local orchestration server, artifact schema, path safety, OAuth/MCP endpoints, model adapters, and agent runtime glue.
- `plugins/autodirector-codex/` - portable Codex plugin skills for the AutoDirector agent team.
- `docs/agent-skills/` - role prompts and quality rules used by the production agents.
- `examples/` - a neutral sample brief for dry-run evidence.
- `JUDGE_GUIDE.md` - the fastest reviewer walkthrough.

This public repository intentionally excludes the showcase website, generated videos, screenshots, build output, logs, private runtime state, and `node_modules`.

## Run Locally

Requires Node.js 22 or newer.

```bash
npm ci
npm run build
npm start
```

Then open:

```text
http://127.0.0.1:8787
```

For development:

```bash
npm run dev
```

## Verification

Portable offline check:

```bash
npm run verify:quick
```

This runs lint, unit checks, a production build, offline smoke checks, and a local healthcheck. It does not require public network access, a Codex login, or media-generation quota.

To regenerate the clean source ZIP:

```bash
npm run zip:code
```

Full public/native verification is environment-dependent:

```bash
npm run verify:full
```

## Model Routes

Codex / ChatGPT OAuth is the default local route. OpenAI-compatible, DeepSeek, Qwen, Anthropic, and custom endpoint text adapters are wired through local environment variables documented in `.env.example`; the UI does not store API keys.

## Public Demo

Project showcase:

```text
https://autodirector.felixypz.me/
```

Read-only control UI:

```text
https://autodirector.felixypz.me/control-ui/
```

The public demo is display-only. The source in this repository is the review target.
