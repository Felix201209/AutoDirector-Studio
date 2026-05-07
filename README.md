# AutoDirector

AutoDirector is a local-first multi-agent video production control room built for the EasyClaw AI Agent Hackathon.

It turns a short video brief into a traceable production pipeline: Producer, Research, Director, Asset, Video Engineer, Render, and Quality Gate agents hand off structured artifacts until a packaged video delivery is ready.

## What To Review

- `src/` - React control room UI.
- `server/` - local orchestration server, artifact schema, security checks, OAuth/MCP endpoints, and agent runtime glue.
- `plugins/autodirector-codex/` - portable Codex plugin skills for the AutoDirector agent team.
- `docs/agent-skills/` - role prompts and quality rules used by the production agents.
- `examples/` - sample brief for a quick dry run.
- `JUDGE_GUIDE.md` - concise walkthrough for reviewers.

This repository intentionally excludes the public showcase website, generated videos, screenshots, build output, logs, private runtime state, and `node_modules`.

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
