# AutoDirector Review Guide

AutoDirector is built for the EasyClaw AI Agent Hackathon. The public website is a read-only showcase; the submitted source ZIP is the verification target.

## 3-minute path

1. Open the public showcase: https://autodirector.felixypz.me/
2. Read the system summary on the homepage: multi-Agent team, real business scenario, runnable code, and traceable delivery.
3. Open `team.html` and `pipeline.html`; the Handoff Trail shows each Agent's input, output, and artifact.
4. Watch the 31s delivery video on the hosted delivery page.
5. Open the read-only control UI at `/control-ui/`.
6. Use the source ZIP to review the local server, React UI, Agent skills, packaging scripts, and verification commands.

For a second scenario, inspect `examples/smart-water-bottle/brief.json` and its `evidence-plan.json`.

## Review Checklist

- Digital team fit: 7 persistent Agents with clear roles, handoffs, and quality gates, plus Recorder evidence for reuse.
- Business scenario: short-video production from user brief to packaged delivery.
- Runnable product: local React UI, Node server, MCP/OAuth routes, Codex Native orchestration, and offline smoke tests.
- Evidence quality: final video plus `source-project.json`, `voice_screen_map.json`, `quality_report.json`, `sync_quality.json`, and render script.
- Alternate brief: the source ZIP includes `examples/smart-water-bottle/brief.json` plus `evidence-plan.json` to show the same pipeline on a product-launch scenario without fake rendered media.

## Run locally

```bash
npm ci
npm run build
npm start
```

Open:

```text
http://127.0.0.1:8787
```

## Offline verification

This path does not require Codex CLI, ChatGPT login, public network access, ffmpeg, or image-generation quota:

```bash
npm run verify:quick
```

For a portable source ZIP check:

```bash
npm run verify:judge
```

## Full native Agent run

Full mode is optional and environment-dependent. It can use the local Codex/ChatGPT login and may consume model or image-generation quota. The Settings UI also documents adapter routes for ChatGPT/OpenAI API, Claude/Anthropic API, DeepSeek API, Qwen API, and OpenAI-compatible custom endpoints; API keys are expected in local environment variables, not stored in the UI.

Requires:

- Node >= 22
- Codex CLI / Codex desktop app environment with login
- Network access for native model/tool calls
- `zip`, `unzip`, and `zipinfo`
- `ffmpeg` / `ffprobe` for final media inspection

Run:

```bash
npm run verify:full
```

## Source ZIP contents

The source ZIP contains:

- Local React Web UI
- Local Node server
- MCP/OAuth route implementation
- Codex Native Agent orchestration
- Agent skills and documentation
- Offline smoke / healthcheck scripts
- Source package builder
- Existing-v10 package wrapper (`npm run package:v10-existing`)
- General example brief and evidence plan under `examples/smart-water-bottle/`

It intentionally excludes the public showcase site, public videos, audio, screenshots, generated delivery packages, built control UI assets, local state, dependency folders, and machine-specific caches. The root `index.html` is retained because it is required by the runnable Vite app.

## Design note

The control UI uses a compact editorial control-room style, documented in `DESIGN.md` and reflected in the React/CSS implementation. Status color is functional: mint means ready/running, coral means active action, red means missing or blocked, and gray means optional or read-only.

## Known limitations

- Public website is read-only by design.
- Full native Agent execution requires local Codex/ChatGPT login.
- Image generation may consume quota.
- If image generation is unavailable, AutoDirector blocks final packaging instead of faking `final.mp4`.
- Public demo assets are hosted separately from the source ZIP to keep the ZIP small.
- Local `.autodirector/state.json` is machine-bound; rerun setup instead of copying state between machines.

## Safety note

Full native mode can create and modify files inside the selected workspace. Run it in a disposable or dedicated project directory when evaluating automation behavior.
