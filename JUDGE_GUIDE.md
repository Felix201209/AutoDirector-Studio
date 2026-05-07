# AutoDirector Judge Guide

AutoDirector is built for the EasyClaw AI Agent Hackathon. The public website is a read-only showcase; the submitted source ZIP is the verification target.

## 3-minute path

1. Open the public showcase: https://autodirector.felixypz.me/
2. Watch the 31s delivery video on the hosted delivery page.
3. Open the read-only Control UI at `/control-ui/`.
4. Inspect the Agent pipeline pages on the hosted showcase.
5. Use the source ZIP to review the local server, React UI, Agent skills, packaging scripts, and verification commands.

For a non-news, non-public-figure sample prompt, inspect `examples/smart-water-bottle/brief.json`.

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

For a judge-friendly source ZIP check:

```bash
npm run verify:judge
```

## Full native Agent run

Full mode is optional and environment-dependent. It can use the local Codex/ChatGPT login and may consume model or image-generation quota.

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
- General example brief at `examples/smart-water-bottle/brief.json`

It intentionally excludes the public showcase website HTML, videos, audio, screenshots, generated delivery packages, local state, dependency folders, and machine-specific caches. The root `index.html` is retained because it is required by the runnable Vite app.

## Known limitations

- Public website is read-only by design.
- Full native Agent execution requires local Codex/ChatGPT login.
- Image generation may consume quota.
- If image generation is unavailable, AutoDirector blocks final packaging instead of faking `final.mp4`.
- Public demo assets are hosted separately from the source ZIP to keep the ZIP small.

## Safety note

Full native mode can create and modify files inside the selected workspace. Run it in a disposable or dedicated project directory when evaluating automation behavior.
