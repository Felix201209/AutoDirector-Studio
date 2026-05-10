# AutoDirector

AutoDirector is a local-first control room where an AI production team turns a video brief into a traceable delivery package.

It keeps the important work visible: who owned each step, which assets were used, what passed quality review, and what shipped.

Review-use license: this public source release is provided for hackathon evaluation, not as an open-source template. See `LICENSE` before copying, redistributing, or reusing it.

It presents a persistent AI digital team:

- Seven production Agents: Producer, Research, Story Director, Asset, Video Engineer, Render, and Quality Gate.
- Recorder: the eighth persistent Agent, running beside the pipeline to record handoffs and turn useful lessons into generated skill drafts.
- Script, caption, motion, sound, topic, and runtime-planning duties are folded into those core roles so the team reads like a real compact studio, not a card wall.
- Runtime packs: HyperFrames and Remotion.
- One-click generation: creates the final video, source project, asset manifest, citations, quality report, run log, Recorder summary, generated skill drafts, and a final ZIP package.

## Run

```bash
npm ci
npm run build
npm start
```

Open:

```text
http://127.0.0.1:8787
```

For development:

```bash
npm run dev
```

Portable offline verification:

```bash
npm run verify:quick
```

This starts an isolated local server, checks the offline bootstrap/onboarding path, validates syntax, builds the UI, and regenerates the clean source ZIP. It does not require Codex CLI, ChatGPT login, public network access, ffmpeg, or image-generation quota.

Full native Agent verification is optional and environment-dependent:

```bash
npm run verify:full
```

Full mode checks Codex Native capability discovery, OAuth/MCP behavior, public deployment assets, final media, and the strict imagegen gate. It expects the local Codex/ChatGPT environment and public network access.

## Review Guide

For the fastest review path, start with:

```text
JUDGE_GUIDE.md
```

The public website is a read-only showcase. The source ZIP is the verification target.

## Environment

Required for the portable review path:

- Node >= 22
- `npm ci`
- `zip`, `unzip`, and `zipinfo`

Optional for full native mode:

- Codex CLI / Codex desktop app environment with login
- Network access for native model/tool calls
- `ffmpeg` / `ffprobe` for media inspection

Copy `.env.example` only if you need to override local host, port, state, or workspace paths.

## Local Audio Helper

The repo includes a small `.ncm` converter for local music inspection:

```bash
npm run ncm -- song.ncm
npm run ncm -- ./music --recursive --dry-run --json
```

It exists so Sound can inspect metadata and choose background music with a written reason. Random, uninspected music selection fails Quality Gate.

## First Run

The Web UI opens a step-by-step setup wizard:

1. Select agent host: Codex Native, Codex Plugin, API Adapter, Claude Code/other coding agent, or custom MCP agent.
2. Select model provider: Codex/ChatGPT OAuth, ChatGPT/OpenAI API, Claude/Anthropic API, DeepSeek API, Qwen API, OpenAI-compatible custom endpoint, or external MCP/manual agent.
3. Select visual provider: Codex/ChatGPT imagegen, OpenAI Image API, user upload, or public/source assets only.
4. Select default video runtime: HyperFrames or Remotion.
5. Select layout: Simple or Full Detail.

These choices can be changed later in Settings.

Model provider notes:

- Codex / ChatGPT OAuth is the default path and does not require an API key; it uses the user's local Codex login and native tools.
- API providers are direct text adapter routes for Producer/Agent artifact calls. Put secrets in local environment variables such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY` / `QWEN_API_KEY`, or `CUSTOM_MODEL_BASE_URL` + `CUSTOM_MODEL_API_KEY`; the UI does not store API keys.
- `codex-default`, `codex-coding`, `local-tool-runner`, and `deterministic-recorder` are AutoDirector-internal routing aliases, not claims about public model IDs. Set `AUTODIRECTOR_CODEX_MODEL` only when the local runtime requires an explicit concrete model id.
- Claude, DeepSeek, Qwen, and custom endpoints can run text/code Agent tasks through the same artifact handoff contract. If the selected provider cannot generate images, choose Codex imagegen, OpenAI Image API, user upload, or public/source assets for visuals.

## Codex Native Agent Route

The default execution mode is `Codex Native`.

AutoDirector starts a local Codex app-server and creates persistent Codex threads:

- one Producer thread for normal Web UI conversation;
- one independent Agent thread per production role after production starts;
- native `image_generation` and `tool_search` through the user's local Codex/ChatGPT login.

Native Codex sessions are spawned outside the project directory by default, under `~/.autodirector/codex-workspaces/<project-name>`. Native session records, prompts, and event logs are also written outside the project by default, under `~/.autodirector/codex-sessions/<project-name>`. Set `AUTODIRECTOR_CODEX_WORKDIR` and `AUTODIRECTOR_CODEX_SESSION_DIR` to override those locations.

`codex exec` is not used for production Agents. The handoff is artifact-based: every Agent writes a versioned artifact, and the next Agent receives only the relevant upstream artifacts.

## Codex Plugin Route

AutoDirector ships a local Codex plugin at:

```text
plugins/autodirector-codex
```

The plugin includes role-specific skills for Producer, Research, Visual/Imagegen, Director, Builder, Quality Gate, and Recorder. It connects to AutoDirector through the local MCP endpoint at `http://127.0.0.1:8787/mcp`, so Codex can create runs, inspect Agent tasks, submit artifacts, register generated images, inspect Recorder memory, and request final packaging.

This route is useful when the user wants Codex itself to act as Producer through MCP. The current default Web UI route uses Codex Native directly; the plugin remains a portable way to expose the same Agent skills and MCP tools to Codex.

## One-Click Video Generation

After onboarding, send a normal message to Producer to shape the brief. AutoDirector will not start production from casual chat. Click `开始制作` when the brief is ready.

The local server will:

1. Create a run.
2. Run Producer plus the six persistent production Agents in order.
3. Generate or register real visuals. For generated product visuals, Asset must use native Codex/ChatGPT `image_generation`; local HTML/SVG/canvas diagrams cannot pass the quality gate.
4. Write `caption_styleguide.json`, `motion_board.json`, `sound_plan.json`, `asset_manifest.json`, and `runtime_plan.json`.
5. Build a runnable HyperFrames or Remotion source project.
6. Render a 30-second 9:16 `final.mp4` with an audio stream when narration/music is requested.
7. Run automated quality checks against the rendered mp4, assets, source project, subtitles, and runtime plan.
8. Ask Recorder to persist the run memory and generate reusable skill drafts.
9. Build `source_project.zip` and `<run-id>-final-package.zip`.

## Agent Skill Stack

The production team now has explicit quality skills:

- Caption Designer: subtitle safe area, line breaks, emphasis, mute-viewing comprehension.
- AutoDirector Product Promo Video: source-faithful recipe for the original `intro-site/hero-video` hero film, including 7-station liquid-glass walkthrough, HyperFrames/GSAP timing, TTS/VTT, imagegen panels, and automated quality gates.
- Voice-Screen Sync: final-audio-based timing so narration, captions, and visible screen events line up.
- Visual Composition: frame hierarchy, hero image placement, card density, typography, and contact-sheet layout quality checks.
- TTS Quality: AI/neural voice auditioning, pronunciation, silence trim, retiming, and final voice rejection rules.
- Science / News Explainer Video: v10-style 科普短片 recipe for conflict framing, mechanism explanation, TTS sync, true vertical layout, music selection, and quality evidence.
- Recorder: durable `recorder_log.jsonl`, `recorder_summary.md`, `skill_suggestions.json`, and generated `SKILL.md` drafts from each run's actual lessons.
- Motion Designer: transitions, easing, rhythm map, GSAP/Remotion timing constraints.
- Sound Designer: AI/neural TTS, modern music direction, SFX cue sheet, ducking, generated/local fallback, license risk.
- Asset Agent: Browser Use / Computer Use decision tree plus OpenAI `imagegen` prompt packs.

## Product-Film Quality Bar

AutoDirector's own intro film is the minimum reference for product/team explainers. A production run should exceed that baseline by splitting the work deliberately and letting Recorder preserve what was learned:

- Producer requires a `visual_event_map`, `voice_screen_map`, `visual_composition_plan`, `tts_plan`, `sound_plan`, `imagegen_prompt_pack`, `motion_board`, and automated quality gates before implementation.
- Script writes voiceover as visual cue points, not dense paragraphs. Every spoken sentence needs a screen-event hint.
- Director converts each sentence into a card, source strip, route node, image panel, timeline layer, meter, package item, or transition event.
- Asset/Imagegen create polished background plates and hero visuals with overlay-safe zones; runtime code renders exact text.
- Sound uses AI/neural TTS for final narration and modern pop/electronic/indie/soft-house style music by default. Do not default to funk/phonk unless the user asks for those genres. If the user asks for local NetEase music, use the `ncm-to-mp3` manifest workflow and inspect/listen before choosing.
- Video Engineer implements sentence-level visual events as real DOM/components and animates them at the matching final-audio TTS/VTT or `voice_screen_map` timestamps.
- Render produces final media plus preview/contact-sheet evidence.
- Quality Gate fails videos where the narrator says more than the screen shows, where the voice sounds like an OS system voice, or where music taste ignores the user.
- Recorder records the handoff trail and produces reusable skill drafts without blocking output.

The local image generation skill is referenced at:

```text
${CODEX_HOME:-~/.codex}/skills/imagegen/SKILL.md
```

Generated images must come from Codex/ChatGPT plugin imagegen, an explicit Image API provider, or user-uploaded assets. AutoDirector must not pass HTML/SVG/canvas/local raster diagrams as generated hero visuals. If the selected host cannot generate images, the image task is blocked honestly while the rest of the pipeline remains usable.

Outputs are stored in:

```text
.autodirector/runs/<run-id>/final-package/
```

The package starts with `judging_readme.md`, which gives reviewers the fastest path through the demo, the Agent handoff trail, visual evidence, quality blockers, Recorder memory, and the final package map.

## OAuth / MCP

The server implements the ChatGPT Apps/MCP OAuth shape:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
- `/.well-known/openid-configuration`
- `/oauth/register`
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/jwks`
- `/oauth/start`
- `/oauth/callback`
- `/mcp`

Implemented behavior:

- Dynamic client registration.
- Authorization code + PKCE (`S256`).
- Local consent page.
- RS256 JWT access tokens.
- JWKS publication.
- MCP `tools/list` and `tools/call` require `Authorization: Bearer <token>`.
- Failed MCP auth returns `401` with `WWW-Authenticate` pointing to protected-resource metadata.

This is a complete local authorization server for the AutoDirector MCP server. It still does not claim that a standalone local Web UI can spend a user's ChatGPT subscription quota directly; ChatGPT would connect to this as an MCP/App client and run the OAuth flow.

## Why AutoDirector

AutoDirector is built around a simple product promise: turn a loose video brief into a traceable production handoff, not a black-box prompt result. The review package makes that workflow visible:

- A clear multi-agent team with roles and handoffs.
- A runnable product UI.
- A reproducible one-click workflow.
- A downloadable final package and reviewable source project.
- A final video that is generated from local video assets, not a static placeholder.
- A visible automation mode, setup wizard, final package room, and persistent Agent artifact trail.

Submission artifacts:

- Public project display site: `https://autodirector.felixypz.me/`
- Public read-only control UI: `https://autodirector.felixypz.me/control-ui/`
- Source ZIP: `autodirector-code.zip`
- General sample brief: `examples/smart-water-bottle/brief.json`
- General sample evidence plan: `examples/smart-water-bottle/evidence-plan.json`

Public review path:

1. Open the public project display site.
2. Read the homepage system summary: multi-Agent team, real business scenario, runnable code, and traceable delivery.
3. Use `Team` and `Pipeline` to inspect the Handoff Trail: each Agent has an upstream input, downstream output, and concrete artifact.
4. Use the read-only control UI to inspect the console. It allows page navigation and state inspection, but does not connect to live Agents or mutate data.
5. Use `Details` and `Delivery` to inspect the final video, citations, quality evidence, package links, and the alternate product-launch brief.

Local runnable path from the source ZIP:

1. Run `npm ci`.
2. Run `npm run build`.
3. Run `npm start`.
4. Open `http://127.0.0.1:8787`.
5. Complete first-run setup, send a production brief, then start the automated pipeline.

Portable verification commands:

```bash
npm run verify:quick
npm run verify:judge
```

Full author/native verification:

```bash
npm run verify:full
```

## Current Submission Proof

The current public proof is the v10 delivery package linked from `delivery.html`.

The source ZIP contains the runnable local app source, Agent skills, example briefs, and verification scripts. It intentionally excludes the public showcase site, large media, built assets, local state, and generated package ZIPs. Use the public URLs below for hosted demo assets, and use `autodirector-code.zip` for source review.

The source ZIP also includes `examples/smart-water-bottle/brief.json` and `examples/smart-water-bottle/evidence-plan.json`, showing the same pipeline on a product-launch scenario without claiming a second hosted video.

- Public final video: `https://autodirector.felixypz.me/assets/musk-altman-agentteam-v10.mp4`
- Public package: `https://autodirector.felixypz.me/assets/musk-altman-agentteam-v10-package.zip`
- Video probe: `720x1280`, `31.1s`, video stream plus audio stream.
- Evidence files in package: `judging_readme.md`, `source_project.zip`, `asset_manifest.json`, `runtime_plan.json`, `research_pack.json`, `citations.md`, `quality_report.md`, `run_log.jsonl`, `recorder_log.jsonl`, `recorder_summary.md`, `skill_suggestions.json`, `generated_skills/*/SKILL.md`, plus the v10 video, hash report, sync/quality JSON, caption blocks, voice-screen map, music report, and render script.
- Quality behavior: offline smoke verifies the portable local path; full smoke verifies that native/OAuth Agent mode waits for artifact submission, can advance a complete Producer -> Research -> Director -> Asset -> Programmer -> Render -> Quality artifact chain, and blocks fake `final.mp4` when OAuth imagegen hero assets are missing.

Verification commands:

```bash
node --check server/index.mjs
node --check server/codex-native-agents.mjs
node --check server/codex-app-server.mjs
npm run verify:quick
npm run verify:full
```

## Known limitations

- Public website is read-only by design.
- Full native Agent run requires local Codex/ChatGPT login and may use quota.
- Public demo assets are hosted separately from the source ZIP to keep the submitted code package small.
- If image generation is unavailable, AutoDirector blocks final packaging instead of faking a final video.
- Full native mode can create and modify files inside the selected workspace; evaluate it in a dedicated project directory.
- Local state files are machine-bound. Do not copy `.autodirector/state.json` between devices; rerun setup on the target machine.

## License and review use

This submission is not open source. See `LICENSE`: source is provided for hackathon review and private evaluation. Pull requests to the original project are welcome, but copying, redistributing, resubmitting, or presenting a modified version as a separate project requires explicit written permission.

## Privacy

AutoDirector runs locally by default. API keys and custom endpoint URLs are expected in local environment variables and are not saved by the Settings UI. Local state is machine-bound by design. The public showcase is static/read-only and should not expose local state, backend APIs, personal home paths, or generated source ZIPs.

## Terms

The public website and source ZIP are provided for hackathon evaluation. Generated videos, news assets, and third-party source material remain subject to their original licenses and source terms; public redistribution should use the included citations and quality evidence.

## Copyright note for local audio

The `.ncm` converter is for local assets you own or have permission to use. It is not intended for bypassing copyright or redistributing protected music.
