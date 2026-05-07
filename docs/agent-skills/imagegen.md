# Imagegen Production Skill

## Role

This is the project-facing wrapper for the local `imagegen` skill at `${CODEX_HOME:-~/.codex}/skills/imagegen/SKILL.md`. Asset Agent uses it when public web imagery is risky, unavailable, too generic, or visually weak.

Image generation is treated as an Agent capability. In a connected Codex/ChatGPT OAuth runtime, the Agent may have an `imagegen` tool without a project-level `OPENAI_API_KEY`. AutoDirector must use that OAuth Agent capability for live image generation. The project must not call the raw OpenAI Image API or require a project-level `OPENAI_API_KEY` for generated video images.

## Owner

Primary owner: Asset Agent.

Consumers:

- Director, for intended visual style.
- Runtime Planner, for file placement and resolution.
- Video Programmer, for layout/crop rules.
- Quality Gate, for source and rights audit.

## When To Use

Use imagegen for:

- Abstract control-room scenes.
- Agent team symbols or icons.
- Product-neutral UI mockups.
- Final package proof graphics.
- Background plates.
- Illustration-style explainer assets.
- Safe alternatives when web images have unclear rights.

Do not use imagegen for:

- Factual screenshots that must show a real website.
- Logos/trademarks unless the user owns them.
- Real people or identity-preserving edits without explicit user-provided inputs.
- Text-heavy images where exact text matters and can be rendered better in code.

## Required Procedure

1. Classify each image request with the imagegen taxonomy.
   - `ui-mockup`
   - `infographic-diagram`
   - `logo-brand`
   - `stylized-concept`
   - `product-mockup`

2. Write a structured prompt.
   - Use case.
   - Asset type.
   - Primary request.
   - Style/medium.
   - Composition/framing.
   - Lighting/mood.
   - Constraints.
   - Avoid list.

3. Save prompts before generation.
   - `imagegen_prompt_pack.json`
   - Include intended shot IDs and fallback path.

4. Acquire through the best available capability.
   - First choice: connected Agent runtime imagegen tool using `gpt-image-2`.
   - Second choice: already-generated local artifact from another Agent, e.g. `output/imagegen/<project>/scene-01.png`.
   - Last resort: hand off prompt pack and mark local fallback clearly.

5. Register OAuth/Codex generated assets with AutoDirector.
   - Save final files as `scene-1.png`, `scene-2.png`, `scene-3.png`, etc.
   - Use an absolute directory path, for example `output/imagegen/run_123`.
   - Call MCP:

```json
{
  "tool": "autodirector_register_image_assets",
  "arguments": {
    "runId": "run_123",
    "assetDir": "/absolute/path/to/output/imagegen/run_123"
  }
}
```

   - If MCP is unavailable, call:

```bash
curl -X POST http://127.0.0.1:8787/api/runs/run_123/register-image-assets \
  -H 'content-type: application/json' \
  -d '{"assetDir":"/absolute/path/to/output/imagegen/run_123"}'
```

   - After registration, packaging imports those files into `assets/imagegen/scene-N.png`.

6. If generation is unavailable, hand off prompt pack.
   - Runtime Planner can choose code-generated fallback.
   - Quality Gate must mark image generation as planned, not executed.

## Video Hero Image Rules

For generated images used inside video:

- Generate the visual subject only. Do not render title/caption text in the image.
- Avoid any visible words, fake UI text, watermarks, logos, tool labels, or model names.
- Make the subject strong enough to survive cropping.
- State exact placement:
  - `full_width_hero_zone`
  - `full_bleed_background`
  - `data_subject_image`
  - `package_proof_visual`
- For `full_width_hero_zone`, compose for a crop around the middle 40-50% of a 9:16 frame or output a horizontal cinematic plate.
- Leave room for Runtime/Programmer to overlay top title and bottom caption plates.
- If the generated image accidentally includes visible text, Asset must either regenerate, crop it out, or mark it for Programmer to cover. Do not pass it silently.

## Premium Product-Film Imagegen Rules

For AutoDirector-style product intros and agent-team explainers, imagegen must provide visual plates that make the film feel produced, not merely decorated.

Required:

- Generate multiple distinct visual modes, not five variants of the same dashboard:
  - opening media engine or product metaphor;
  - Producer routing/control-room plate;
  - Research/Story evidence wall;
  - Asset/image-generation production wall;
  - HyperFrames/timeline/editing plate;
  - Render/quality proof plate;
  - final package/delivery plate.
- Prompts must specify bright modern editorial lighting, liquid-glass materials, clean depth, readable negative space, and no visible text.
- Generated backgrounds should leave safe zones for runtime text/card overlays. Ask for "blank glass areas", "soft empty margins", or "clear central subject with overlay-safe side regions".
- Do not ask imagegen to create exact UI labels, captions, file names, or Chinese text. Runtime code renders those.
- Avoid repetitive cliches: dark server rooms, glowing hooded operators, purple AI gradients, random node balls, unreadable dashboard text, stock-photo hands, cheesy lens flares.
- For background plates, ask for texture and depth but low detail behind captions.

Example prompt pattern:

```text
Use case: ui-mockup
Asset type: product-film background plate for shot_04 asset wall
Primary request: bright liquid-glass production wall with floating image panels, subtle waveform strips, storyboard thumbnails, and validation gates, no readable text
Composition/framing: horizontal cinematic plate, clear center-left subject, overlay-safe empty glass area on right, works behind runtime cards
Lighting/mood: modern pop-tech editorial, daylight glass, premium, restrained
Color palette: off-white, mint, pale blue, warm amber, charcoal accents
Constraints: no words, no logos, no watermark, no people, no dark room
Avoid: purple AI gradient, fake tiny dashboard text, funk/phonk club mood, noisy clutter, template cards
```

## Output Artifact

### `imagegen_prompt_pack.json`

```json
{
  "skill": {
    "name": "imagegen",
    "path": "${CODEX_HOME:-~/.codex}/skills/imagegen/SKILL.md",
    "model_default": "gpt-image-2",
    "requires": "OAuth Agent imagegen capability; no raw Image API fallback"
  },
  "prompts": [
    {
      "id": "img_hero_control_room",
      "use_case": "ui-mockup",
      "asset_type": "video hero/background",
      "placement": "full_width_hero_zone",
      "shot_ids": ["shot_01", "shot_02"],
      "prompt": "Cinematic editorial production control room receiving a video brief, dark professional lighting, strong central subject, designed to crop into a full-width hero zone in a 9:16 short video. No text.",
      "avoid": "stock-photo vibe, cheesy neon, unreadable text, fake brand logos, tool labels, dashboard card template",
      "fallback": "code-generated SVG card"
    }
  ]
}
```

## Validation Checklist

- Every generated-image request maps to a shot.
- Every major spoken beat has either a generated/source plate or a deliberate code-rendered information layer.
- Prompt includes constraints and avoid list.
- Text-heavy content is rendered in runtime code, not baked into images.
- Source is recorded as generated by imagegen when live call succeeds.
- Runtime imagegen capability or local registered artifact path is recorded.
- OAuth-generated files are registered through MCP or REST before packaging.
- Missing live generation is recorded without blocking the whole pipeline, but Quality Gate must know it was a fallback.

## Done When

Asset Agent has either generated images with recorded prompts or a reproducible prompt pack plus local fallback.
