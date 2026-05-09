# AutoDirector Completion Audit

Last updated: 2026-05-07

Author verification only. Judge network, local tools, and Codex login state may differ. For portable review, start with `JUDGE_GUIDE.md` and run `npm run verify:quick`; public/network and native Codex checks are intentionally separated into `npm run verify:full`.

## Objective

Keep upgrading AutoDirector toward an EasyClaw hackathon finalist/winner demo:

- Web UI control room for a real multi-Agent video production team plus non-blocking Recorder memory.
- Native Codex Kernel execution with persistent Producer and Agent threads.
- Real artifact handoff between Agents; no fabricated completion path.
- Real native image generation or direct-source editorial evidence for hero visuals.
- One-click production that can render or honestly block the final video package.
- Automated quality gates that reject fake, weak, or under-sourced output.
- Submission-ready source ZIP, pure-static public showcase assets, and judge-friendly package contents.

## Prompt-To-Artifact Checklist

| Prompt / Requirement | Current Artifact | Evidence |
| --- | --- | --- |
| EasyClaw required project showcase website | `https://autodirector.felixypz.me/` and `https://autodirector.felixypz.me/control-ui/` | EasyClaw hackathon page checked live on 2026-05-04: the required submission items are `项目展示网站` and `代码压缩包`. Public URL checks belong to `npm run healthcheck:public` / `npm run verify:full`, because judge networks may differ. |
| EasyClaw required code ZIP | `autodirector-code.zip` | `npm run zip:code` rebuilds a clean source ZIP. It now includes local app source plus public showcase HTML/CSS/JS source and `intro-site/demo-manifest.json`, while still excluding `node_modules`, `.tmp`, `dist`, built public Control UI assets, public media, generated packages, Python bytecode/cache, legacy audit-style entry names, nested ZIPs, temporary screenshots, and macOS metadata. |
| Public 1:1 Control UI must be reachable but read-only | `intro-site/control-ui/` served at `/control-ui/` | Public browser audit at 1440px and 390px found no `/api/` resource requests, disabled textareas/buttons for agent execution, no horizontal overflow, and no old audit-copy strings. |
| Public UI must not allow talking to an Agent | `src/App.tsx`, public bundle `index-LLUHMqSN.js` | Runtime browser evaluation found the textarea disabled, no enabled mutation buttons, no backend API resource requests, and no backend API path in the public read-only bundle. |
| Public Control UI project label should stay compact | `src/App.tsx`, `intro-site/control-ui/` | The public read-only run title is `Musk vs Altman v10`, and healthcheck rejects the old long `正式通过 AutoDirector Agent Team...` title. Project rows include explicit `aria-label` text for title, runtime, and status. |
| Control UI shell labels should be Chinese and calm | `src/App.tsx`, `scripts/healthcheck.mjs` | Bottom console, terminal setup dialog, onboarding actions, blocked-render notices, copy states, and handoff cards now use Chinese UI labels. Healthcheck requires `流水线时间轴` and `工具控制台`, and rejects stale labels such as `Pipeline Timeline`, `Tool Console`, `Terminal Setup`, `Enter Control Room`, `Producer Plan`, and `Artifact Handoff`. |
| Review/approval operation should be automated away | `src/App.tsx`, `src/data/autodirector.ts`, `server/index.mjs`, `intro-site/pipeline.*`, `scripts/smoke.mjs` | UI labels now use `Quality Gate`, `自动质检`, `质量门`, and `自动交付`; static scans across source and public bundle found no visible legacy review/approval strings outside the intentionally untouched delivery page. |
| Visible team terminology should consistently say Agent, not worker | `README.md`, `DESIGN.md`, `plugins/autodirector-codex/*`, `docs/agent-skills/*`, `server/index.mjs`, `server/codex-native-agents.mjs` | User-facing docs, plugin skills, generated package text, server prompts, logs, and MCP descriptions use Agent terminology. Internal code variables/data keys may still use `worker` for compatibility. |
| Local Web UI top bar and Settings should be cleaner | `src/App.tsx`, `src/index.css` | Desktop/mobile screenshots and Playwright snapshots confirm the compact glass header, simplified status cluster, collapsed run history, current-project sidebar card, Chinese shell labels, segmented Settings groups, mobile Settings content-first ordering, and less crowded Settings cards. |
| UI should avoid brittle typography and hidden focus states | `src/index.css`, `intro-site/styles.css`, `intro-site/hero-video/index.html`, `scripts/healthcheck.mjs` | Source scan and healthcheck now reject `transition: all`, `outline: none`, negative letter-spacing, and viewport-driven `font-size: clamp(...)`; public bundle CSS is also checked for real declaration anti-patterns. |
| Public static CSS should not serve stale typography or mobile background positioning | `intro-site/index.html`, `intro-site/team.html`, `intro-site/details.html`, `intro-site/pipeline.html`, `intro-site/control-room.html`, `scripts/healthcheck.mjs` | Non-delivery static pages now load `styles.css?v=20260504ambientfit`; public browser evaluation confirms the homepage loads that URL directly, computed heading letter-spacing is normal, and mobile ambient lights stay inside the viewport. Healthcheck enforces this CSS version on local and public non-delivery pages. |
| Public delivery must stay on current v10 while v9 remains legacy | `intro-site/delivery.html`, `intro-site/assets/musk-altman-agentteam-v10-package.zip` | `delivery.html` targets the v10 film and v10 package URL, uses Chinese navigation, and lists the public package contents directly. v9 evidence assets remain historical/legacy artifacts, not the page target. |
| Demo should be static/public, not backend-dependent | `intro-site/*`, `scripts/healthcheck.mjs` | Public `/api/bootstrap` returns 404 by design; healthcheck verifies public root/control UI/final video/package without relying on local WebUI backend state. |

## Current Evidence Checklist

| Requirement | Evidence |
| --- | --- |
| 7-Agent model is consistent | `server/index.mjs`, `src/data/autodirector.ts`, `README.md`, `intro-site/*`, and `docs/agent-model-policy.json` now describe one Producer plus six production Agents: Research, Story Director, Asset, Video Engineer, Render, Quality Gate. |
| Default execution is Codex Native Kernel | `README.md` documents the default route; `/api/bootstrap` reports `settings.executionMode: codex_native`; `server/index.mjs` maps old `codex_cli` to `codex_native`. |
| Workers are persistent native Codex threads | `server/codex-native-agents.mjs` creates per-run/per-agent threads and records `run.codexThreads[agentId]`. |
| No `codex exec` Agent path | Static checks no longer find the retired fake CLI route. Production waits on native artifact submissions instead of shelling out to a fabricated completion path. |
| Producer chat is separate from production start | Web UI chat uses Producer stream; production starts through Start Production / one-click dispatch. |
| Artifact handoff is explicit | Each task has input artifacts, output artifacts, owner Agent, status, success criteria, and a handoff rule. |
| Recorder memory is durable | `server/index.mjs` records run creation, task start, artifact submission/blocking, image asset registration, package preflight, and package result into `recorder_log.jsonl`, `recorder_summary.md`, `skill_suggestions.json`, and generated skill draft folders. Recorder is sidecar-only and does not block the production pipeline. |
| Strict visual gate exists | Asset preflight generates or registers hero visuals; `strictImagegenGate` rejects local HTML/SVG/canvas fallback as final hero visuals. |
| Quality gates can block weak output | Smoke coverage confirms the quality/imagegen gate blocks fake `final.mp4` output when OAuth imagegen assets are absent. |
| Final package is judge-friendly | `generateFinalPackage` now writes `judging_readme.md` alongside `final.mp4`, source ZIP, manifests, prompt pack, citations, quality report, transcript, script, shotlist, run log, Recorder memory, and generated skill drafts. |
| Source ZIP is clean | `scripts/package-code.mjs` creates root `autodirector-code.zip` while intentionally including public showcase source files and excluding public media, built public Control UI assets, `.autodirector`, Playwright output, logs, Python bytecode/cache, legacy audit-style entry names, and generated ZIP copies from `intro-site`; it fails the build if forbidden entries are present after packaging. The frozen `delivery.html` content is preserved by user request and audited as an explicit exception. |
| README is current | `README.md` documents native route, plugin route, 7-Agent team, generated package contents, and verification commands. |
| Public demo URL is reachable | `https://autodirector.felixypz.me/` returns HTTP 200 from the static `intro-site` server. |
| Public demo has no backend API | `https://autodirector.felixypz.me/api/bootstrap` returns HTTP 404, confirming the public live demo is display-only and not connected to WebUI backend state. |
| Public final video URL is reachable | `https://autodirector.felixypz.me/assets/musk-altman-agentteam-v10.mp4` returns HTTP 200 with `content-type: video/mp4`; `delivery.html` points at this current v10 film. |
| Public final package ZIP is reachable | `https://autodirector.felixypz.me/assets/musk-altman-agentteam-v10-package.zip` returns HTTP 200 with `content-type: application/zip`; `delivery.html` points at this v10 package URL. |
| WebUI/source ZIPs are not public | `intro-site/assets/autodirector-code.zip` and `intro-site/assets/autodirector-source.zip` were removed; public requests for those paths return 404. |
| Official public delivery package is current | `musk-altman-agentteam-v10-package.zip` includes the unchanged v10 film plus `judging_readme.md`, `source_project.zip`, `asset_manifest.json`, `runtime_plan.json`, `research_pack.json`, `citations.md`, `quality_report.md`, `run_log.jsonl`, render script, source/evidence manifests, music report, caption blocks, TTS plan, `voice_screen_map.json`, and `sync_quality.json`. |
| One-command local healthcheck exists | `npm run healthcheck:local` verifies local static files, Node syntax, and the clean source ZIP without requiring public network access. `npm run healthcheck:public` checks the deployed showcase, manifest-declared Control UI deep links, and public media package. |
| Submission gate is judge-friendly | `npm run verify:submission` maps to `npm run verify:judge`, which uses the portable offline path. `npm run verify:full` keeps the slower public/Codex checks available for author or advanced review. |
| Public read-only Control UI is reachable | `https://autodirector.felixypz.me/control-ui/` serves the built React shell under `/control-ui/assets/`; browser audits found no `/api` requests, no enabled mutating controls, no internal owner-id leak in the plan card, and no horizontal overflow. |
| Browser UI was rechecked | Playwright browser audits covered public static pages and the public read-only Control UI at 390px and 1440px; the latest mobile pass also checked static typography stability and zero horizontal overflow. |

## Latest Verification Commands

Current verification set for the 2026-05-07 judge-readiness hardening:

```bash
node --check server/index.mjs
node --check server/codex-native-agents.mjs
node --check server/codex-app-server.mjs
npm run lint
npm run build
npm run smoke:offline
npm run healthcheck:local
npm run zip:code
npm run verify:submission
npm run verify:full
shasum -a 256 autodirector-code.zip
unzip -l autodirector-code.zip | rg "node_modules|\\.autodirector|output/imagegen|\\.playwright|\\.png|\\.mp4|\\.log" || true
rg -n "9 个|9 workers|8 个核心|8 workers|Eight focused|Script Agent|Runtime Agent" README.md src server docs plugins intro-site -g '!node_modules'
curl -I -L --max-time 20 https://autodirector.felixypz.me/
curl -I -L --max-time 20 https://autodirector.felixypz.me/assets/musk-altman-agentteam-v10.mp4
curl -I -L --max-time 20 https://autodirector.felixypz.me/assets/musk-altman-agentteam-v10-package.zip
curl -I -L --max-time 20 https://autodirector.felixypz.me/api/bootstrap
```

## Latest Results

- `npm run verify:submission` is the portable judge gate: `lint`, `test:unit`, `build`, `smoke:offline`, `healthcheck:local`, and `zip:code`.
- `npm run smoke:codex` now covers three native/OAuth Agent behaviors: waiting for real artifact submission, completing a deterministic Producer -> Research -> Director -> Asset -> Programmer -> Render -> Quality artifact chain, and blocking fake `final.mp4` when OAuth imagegen hero assets are missing.
- `npm run healthcheck:public` checks the current public v10 delivery film/package: `720x1280`, `31.1s`, `video/mp4`, and `application/zip`; it also enforces non-delivery CSS cache-busting, localized static navigation, manifest-declared Control UI deep links, Control UI polish copy gates, UI style anti-pattern scans, legacy audit-copy scans, public read-only bundle scans, public ZIP cleanliness, and absence of legacy audit-style ZIP entries.
- `npm run build:public-ui` produced the current read-only Control UI assets: `index-LLUHMqSN.js` and `index-DdubRd2W.css`; the public `/control-ui/` page now serves the same asset pair.
- `npm run zip:code` produces `autodirector-code.zip`; the final SHA-256 should be read from the latest packaging command because this audit file is included inside the source ZIP.
- ZIP cleanliness scans reject local user paths, personal email, `.DS_Store`, Python bytecode/cache, public videos/audio/images, nested generated ZIPs, `dist`, and built public Control UI assets in `autodirector-code.zip`; the v10 public package is rebuilt by `npm run package:v10-existing` from sanitized evidence files without rewriting the existing video.
- Non-delivery source paths/content, source ZIP entry names, and the v10 public package no longer expose legacy audit-style artifact names; the current public package uses `quality_report.json` and `sync_quality.json`. The only preserved old wording is inside the frozen `delivery.html`, which remains unchanged by the current polish pass.
- Public static pages and public read-only Control UI were checked at mobile and desktop widths with no horizontal overflow, no unlabeled controls, no enabled public mutation controls, no computed negative letter-spacing on audited headings/controls, and no legacy audit-copy strings. The latest direct Chrome CDP audit covered the public homepage at 390px plus public Control UI Settings/Agents/Delivery at 390px and Settings at 1440px; all returned `overflowPx: 0`, no `/api/` resources, no editable public textarea, and no legacy worker/review-agent copy.
- Public demo remains static-only; root pages return HTTP 200 and `/api/bootstrap` returns HTTP 404 by design.
- Public static assets include `assets/musk-altman-agentteam-v10.mp4` and `assets/musk-altman-agentteam-v10-package.zip`; WebUI/source ZIP assets are intentionally not exposed.
- Current public delivery package is the v10 evidence package; v9 remains a legacy artifact and is no longer the page target.

## Current Known Gaps

- A hackathon win cannot be guaranteed by audit language; the codebase can only maximize clarity, reliability, and demo quality.
- The smoke test uses deterministic local smoke assets for the complete artifact-chain package run; a live native imagegen run is still optional because it can be slow and quota-consuming.
- Public deployed URL should still be rechecked immediately before live judging, because public availability depends on the static host/tunnel staying online.
- Full native imagegen/render should be rerun only when quota/time allows; current automated smoke verifies blocking behavior, and the current v10 public package remains the demo artifact.
