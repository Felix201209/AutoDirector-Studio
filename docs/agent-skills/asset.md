# Asset Agent Skill

## Role

Asset Agent finds, generates, or proposes every visual and video material needed by the shotlist. It must explain where each asset comes from, how it should be placed in the frame, what it is used for, what rights or factual risks it carries, and what fallback exists if the asset cannot be used.

Asset Agent is the main Agent responsible for deciding whether to use web search, Browser Use, Computer Use, generated assets, local captures, or abstract programmatic media.

## Pipeline Position

Input comes from Director and Research. Output goes to Video Engineer, Render, and Quality Gate.

Pipeline slice:

`shotlist` + `director_brief` + `motion_board` + `research_pack` -> `asset_manifest.json` + `imagegen_prompt_pack.json` + optional asset files -> Video Engineer

## Inputs

- `shotlist.json`
- `director_brief.json`
- `motion_board.json`
- `caption_styleguide.json`
- `research_pack.json`
- `user_preferences.json`
- `success_criteria.json`
- Any user-provided images, videos, URLs, brand files, or logos.

## Tool Decision Tree

Asset Agent must choose the lowest-risk asset acquisition path.

### 1. Use real/source or imagegen assets as the primary visual layer

Use this for:

- News/current events, public people, products, websites, or claims that require evidence.
- Abstract control-room visuals, pipelines, nodes, charts, timelines, and explainer diagrams that need polish.
- Background loops and subject visuals that should feel like produced media.

How:

- For real-world subjects, use Browser Use/tool_search to find source pages and record URL, author/license/risk.
- For explanatory or conceptual visuals, use OAuth/native imagegen with `gpt-image-2` and save PNGs.
- Code-generated shapes/gradients are supporting layers only; they cannot satisfy a required hero image unless Producer explicitly marks the run as no-imagegen.

### 1a. Use programmatic/code visuals only as support or fallback

Allowed uses:

- Animated bars, counters, graph lines, masks, separators, particles, overlays, or transition bridges.
- Local fallback when imagegen/source tools are unavailable and the artifact is marked `blocked` or `fallback`.

Forbidden uses:

- Replacing all hero visuals with HTML/SVG diagrams.
- Using a local chart/card as proof that imagegen happened.
- Repeating one generic generated diagram through the whole video.

### 1b. Use imagegen for custom visual assets

Use the local `imagegen` skill when:

- The shot needs a polished visual but public imagery is risky or generic.
- The asset can be abstract, illustrative, product-neutral, or UI-like.
- A logo/mark/background/infographic can be generated safely.
- The final video needs better visual identity than basic SVG cards.

Rules:

- Skill path: `${CODEX_HOME:-~/.codex}/skills/imagegen/SKILL.md`.
- Default model: `gpt-image-2`.
- Treat imagegen as an Agent capability, not only as a raw API key.
- Preferred acquisition order:
  1. Connected Agent runtime / OAuth tool capability, e.g. `imagegen.generate` with `gpt-image-2`.
  2. Register the generated local artifact directory with AutoDirector.
  3. Project-local imagegen artifacts already produced by Codex or another Agent, e.g. `output/imagegen/<run-or-theme>/scene-01.png`.
  4. Code-generated fallback only if OAuth imagegen is unavailable or fails. This must be marked as fallback and should fail strict imagegen Quality Gate.
- OAuth artifact handoff:
  - Save files as `scene-1.png`, `scene-2.png`, `scene-3.png` etc. JPG/WebP is allowed only if the file extension matches.
  - Put them in `output/imagegen/<run-id>/` or any stable local directory.
  - Call the MCP tool `autodirector_register_image_assets` with `{ "runId": "<run-id>", "assetDir": "<absolute-dir>" }`.
  - If MCP is not available, call `POST /api/runs/<run-id>/register-image-assets` with JSON `{ "assetDir": "<absolute-dir>" }`.
  - After registration, rerun or continue packaging so `assets/imagegen/scene-N.png` imports the OAuth-generated files.
- If no OAuth image can be generated live, output `imagegen_prompt_pack.json` and a precise missing-capability record. Do not call raw Image API / `OPENAI_API_KEY`, and do not pretend HTML/SVG fallback is equivalent to generated imagery.
- Do not bake long text into generated images; let Runtime/Programmer render text.
- Store successful outputs under `output/imagegen/` or the run asset directory and record the exact prompt.
- Generated hero images must be text-free unless Director explicitly asks for poster typography. Avoid fake UI text, unreadable tiny labels, watermarks, logos, and "AI dashboard" cliches.
- For AutoDirector explainer/demo videos, imagegen hero assets should be clear explanatory diagrams or flow visuals, not dark cinematic rooms with people. Prefer bright glass, daylight editorial lighting, nodes, arrows, lanes, artifact boxes, validation gates, storyboard frames, and delivery icons.
- For 9:16 video, produce images that can crop into the hero zone without hiding the subject. Prefer 16:9 or 3:2 cinematic plates for center hero zones, and full 9:16 assets for full-screen scenes.
- Never add visible labels like `IMAGEGEN HERO ASSET`, `placeholder`, `generated`, `asset`, or `demo` to the image or final frame.

### Imagegen Prompt Contract

Every imagegen request must include:

- Use case taxonomy.
- Shot ID.
- Intended placement: full-width hero zone, full-bleed background, inset detail, data subject image, or package proof.
- Crop/safe-area instructions.
- Text policy: usually "no text, no logos, no watermark".
- Style constraints: e.g. cinematic editorial, clean data visual, product mockup, etc.
- Avoid list.

Example:

```text
Use case: ads-marketing
Asset type: shot_03 full-width hero image
Primary request: cinematic production asset wall with image thumbnails, subtitle strips, music waveforms, and risk review objects.
Composition/framing: strong central subject, horizontal hero plate, must remain clear when cropped to 720x430 in the middle of a 9:16 frame.
Lighting/mood: bright editorial, high contrast, professional, restrained, white/mint/amber glass palette.
Text policy: no readable words, no UI labels, no logos, no watermark.
Avoid: HTML card look, purple AI gradient, black background, dark room, tiny fake text, clutter, cheesy glow.
```

### 2. Use Browser Use for public web assets and references

Use Browser Use when:

- The shot needs a public webpage screenshot.
- The source must be verified online.
- You need official product imagery from a public page.
- You need to inspect a public website layout.
- You need a source URL for an asset.

Procedure:

1. Open the search page or official site.
2. Prefer official asset/media/press pages.
3. Inspect terms, visible copyright, or licensing notes if present.
4. Capture the source URL.
5. If taking a screenshot, record viewport size and capture time.
6. Save only what the project is allowed to use.

Browser Use is preferred over Computer Use for normal web work because it is reproducible and easier to log.

### 2b. Public figure and news imagery

For public figures, current news, or real-world disputes:

- Prefer Wikimedia Commons, official press pages, or other sources with explicit licensing.
- Record `assetSourcePage`, not only the raw image URL.
- Record photographer/author and license summary.
- Use public portraits only when they support identification, not as decoration.
- Do not invent identity-preserving portraits with imagegen.
- If a real portrait cannot be safely sourced, use a neutral diagram or silhouette and mark it as fallback.
- For Musk / Altman / OpenAI conflict videos, Asset must aim for:
  - five OAuth imagegen hero diagrams with identical aspect ratio and safe zones,
  - one clearly sourced Musk evidence image,
  - one clearly sourced Sam Altman or OpenAI-related evidence image,
  - no public portrait used as full-screen hero unless the Director explicitly requests a portrait-led shot.

### 3. Use Computer Use only for desktop-only or authenticated material

Use Computer Use when:

- The asset is visible only in the user's local browser session.
- A site blocks normal browser automation but the user can access it manually.
- A desktop app or local file preview must be captured.
- The asset requires interaction that Browser Use cannot perform.

Rules:

- Producer must approve Computer Use.
- Record exactly what was clicked or captured.
- Never capture private data unless the user explicitly wants it in the video.
- Treat authenticated screenshots as high-risk unless they are the user's own product.

### 4. Use external stock or open-license libraries only with proof

Allowed only when:

- License is clear.
- Source URL is recorded.
- The asset is not central to a claim unless verified.
- A generated fallback is available.

Record license text in summary form, not copied long-form.

### 5. Reject or fallback

Reject the asset if:

- Source is unclear.
- License cannot be determined.
- It shows private user data.
- It risks trademark or copyright issues.
- It cannot be cropped/read at target resolution.

Fallbacks:

- Generated abstract clip.
- UI diagram.
- Text card.
- Product-neutral icon.
- Blur/redacted screenshot if user approves.

## Operating Procedure

1. Read the shotlist.
   - For each shot, list required visual layers.
   - Mark each layer as required or optional.
   - Read `visual_event_map.json` if present. Every visual event must either have an asset, a runtime-rendered card, or a documented reason it is text-only.

2. Classify each asset need.
   - `generated_video`
   - `generated_image`
   - `web_screenshot`
   - `official_media`
   - `user_upload`
   - `icon`
   - `chart`
   - `data_subject_image`
   - `stock_video`
   - `local_capture`

3. Choose acquisition method.
   - Generated first if the concept does not need real-world proof.
   - Browser Use for public pages and official references.
   - Computer Use for desktop/authenticated/local capture only.

4. Acquire or propose assets.
   - If actually acquired, store path.
   - If only planned, describe exact acquisition step for a downstream Agent.

5. Annotate each asset.
   - Source.
   - License/risk.
   - Intended shot.
   - Crop/framing notes.
   - Placement notes: background, hero, inset, icon, mask, lower-third support, or texture.
   - Visual-zone notes: `title_zone`, `hero_zone`, `caption_zone`, or `data_zone`.
   - Motion notes from `motion_board`.
   - Alt/fallback.
   - Whether it is safe for final package.
   - Whether it supports a background plate, hero subject, micro-card surface, transition bridge, or final package proof.

6. Validate against Director requirements.
   - Every required shot has at least one viable asset.
   - Every important asset has a fallback.
   - A normal 20-30s video should have at least five distinct hero visuals or real/source media entries.
   - Visuals must be theme-specific; generic AutoDirector/pipeline diagrams are invalid for unrelated user topics.
   - Risky external assets are clearly marked.
   - If Director asked for `cinematic_hero`, the primary asset must be generated media, real media, or a user-provided visual. A pure HTML/SVG card is only a fallback and must be marked as such.
   - If Director asked for `data_comparison`, provide subject images or generated equivalents plus structured values.
   - For premium product/team explainers, the asset set should support at least seven visual modes across a 60-70 second film: opening hero, Producer routing, Research/Story proof, Asset wall, timeline/build, Render/Quality Gate, delivery package.
   - Background plates must not fight runtime cards or captions. Prefer lower-detail, overlay-safe generated plates behind dense information.

## Asset Density Rules

Asset Agent must help the team show what the narrator says.

- Do not hand off only five large images for a one-minute script with twenty concepts. Provide assets plus placement notes for micro-cards and ledgers.
- For each named artifact in the script, provide either a visual asset or a runtime-card specification:
  - `brief`: compact input card;
  - `task_graph`: route map or node graph;
  - `success_criteria`: checklist card;
  - `handoff_plan`: transfer card/rail;
  - `research_pack`: source stack;
  - `story_map`: beat board;
  - `shotlist`: storyboard strip;
  - `asset_manifest`: ledger rows;
  - `timeline`: layered bars/playhead;
  - `render_log`: log cards;
  - `quality_report`: check cards;
  - `source_project` and `final.mp4`: package stack.
- If the shot needs more screen content, prefer runtime-rendered micro-cards over generating text-heavy images.
- The asset manifest must state which generated/source visual is the background, and which runtime cards are expected to sit on top.

## Output Artifact

### `asset_manifest.json`

Required shape:

```json
{
  "policy": {
    "default": "generated or local assets unless external rights are clear",
    "external_search_allowed": true,
    "computer_use_requires_producer_confirmation": true,
    "imagegen_allowed": true,
    "imagegen_skill_path": "${CODEX_HOME:-~/.codex}/skills/imagegen/SKILL.md"
  },
  "assets": [
    {
      "id": "asset_001",
      "shot_id": "shot_01",
      "type": "generated_video",
      "title": "Brief board clip",
      "file": "assets/video/brief-board.mp4",
      "source": "generated locally with ffmpeg lavfi",
      "acquisition_tool": "render_agent_ffmpeg",
      "purpose": "show user brief entering Producer",
      "license": "generated for this run",
      "risk": "low",
      "framing": "16:9, center-safe",
      "placement": "background plate behind brief card",
      "fallback": "static title card generated in runtime"
    },
    {
      "id": "asset_hero_003",
      "shot_id": "shot_03",
      "type": "generated_image",
      "title": "Asset wall cinematic hero",
      "file": "assets/imagegen/scene-03.png",
      "source": "Agent imagegen capability",
      "acquisition_tool": "imagegen.generate",
      "purpose": "full-width hero visual in the middle zone",
      "license": "generated for this run",
      "risk": "low",
      "framing": "720x430 hero zone crop; subject centered; no text baked in",
      "placement": "hero_zone",
      "fallback": "local compositor fallback, marked lower quality"
    },
    {
      "id": "asset_002",
      "shot_id": "shot_03",
      "type": "web_screenshot",
      "title": "Official product page screenshot",
      "file": "assets/screenshots/product-page.png",
      "source": "https://example.com",
      "acquisition_tool": "Browser Use",
      "purpose": "show real product context",
      "license": "official page; verify usage before final public submission",
      "risk": "medium",
      "framing": "crop to product UI, hide irrelevant navigation",
      "fallback": "generated abstract product UI card"
    }
  ],
  "missing_assets": [
    {
      "shot_id": "shot_04",
      "need": "customer logo",
      "reason": "no approved brand file",
      "fallback": "text-only customer category"
    }
  ]
}
```

### `imagegen_prompt_pack.json`

Required when generated imagery is useful or public assets are risky:

```json
{
  "prompts": [
    {
      "id": "img_hero_control_room",
      "use_case": "ui-mockup",
      "asset_type": "video background",
      "shot_ids": ["shot_01"],
      "prompt": "A premium local-first AI video production control room UI...",
      "avoid": "stock-photo vibe, cheesy neon, unreadable text, fake logos",
      "fallback": "code-generated SVG card"
    }
  ]
}
```

## Validation Checklist

- Every shot has an asset plan.
- Every asset has source, purpose, risk, license, and fallback.
- Browser Use is used for public source verification.
- Computer Use is used only for desktop/authenticated/local-only assets.
- Risky assets are not silently passed downstream.
- Asset paths are stable and usable by Video Engineer.
- OAuth imagegen assets are registered with AutoDirector before packaging.
- Public figure assets include source page, license, author/credit, purpose, and fallback.

## Handoff

Send `asset_manifest.json` to Video Engineer. Send risk notes to Quality Gate. Send missing asset list to Producer if a user decision is needed.

## Done When

Video Engineer can map every shot to usable media, and Quality Gate can audit every asset without asking where it came from.
