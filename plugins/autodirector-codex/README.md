# AutoDirector Codex Plugin

AutoDirector turns Codex into the Producer for a persistent video-production team. Codex does not pretend every Agent finished work in one chat reply. It talks to the local AutoDirector MCP server, pulls the current task, produces or routes the artifact, submits it, and lets the next Agent take over.

## Local Setup

1. Start AutoDirector:

```bash
npm ci
npm start
```

2. Open the Web control room:

```text
http://127.0.0.1:8787
```

3. Install this plugin folder in Codex:

```text
plugins/autodirector-codex
```

4. Connect through the local MCP OAuth flow exposed by AutoDirector. The MCP endpoint requires `Authorization: Bearer <token>` issued by the local OAuth server; the default Web UI route uses Codex Native Kernel directly and does not require a manually copied token.

## Image Generation Rule

Image generation is available only when the host is Codex/ChatGPT plugin mode with the `imagegen` tool, an explicit API image provider, or user-uploaded assets. Other model choices can still run research, script, directing, coding, render, and Quality Gate, but generated hero visuals must be marked blocked until an approved image provider supplies files.

## Typical Flow

1. Producer creates a run with `autodirector_create_run`.
2. Producer dispatches one task with `autodirector_dispatch_next`.
3. The relevant skill produces an artifact and calls `autodirector_submit_agent_artifact`.
4. Visual/Imagegen skill generates scene assets and calls `autodirector_register_image_assets`.
5. Quality Gate checks frames, sources, captions, rhythm, and package completeness.
