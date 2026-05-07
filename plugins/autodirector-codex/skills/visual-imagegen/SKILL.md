---
name: autodirector-visual-imagegen
description: Use when AutoDirector needs generated hero images, editorial diagrams, visual prompt packs, or registration of Codex/ChatGPT imagegen assets.
---

# AutoDirector Visual/Imagegen

This skill is responsible for generated visuals. It exists because fake local diagrams were the failure mode. Do not let that happen.

## Provider Rule

Generated image tasks can pass only through one approved route:

- Codex/ChatGPT plugin host with the `imagegen` tool, preferably `gpt-image-2`.
- Explicit image API provider selected by the user.
- User-uploaded image files that satisfy the scene requirement.

If none is available, submit a blocked artifact. Do not replace imagegen with HTML, SVG, canvas, CSS, screenshots, or local raster diagrams.

## Workflow

1. Read `blocked_imagegen_request.json` or the current Asset/Visual task.
2. Confirm the required count, aspect ratio, scene purpose, style, and any `visual_composition_plan.json`.
3. For each scene, write one precise prompt:
   - visual structure first
   - readable empty space for captions
   - explicit aspect ratio
   - no text burned into the image unless requested
   - no UI labels like "imagegen asset"
   - background safe zones for runtime-rendered micro-cards and captions
   - distinct visual mode, not another variant of the previous scene
   - primary subject large enough to read in a 1-frame-per-second contact sheet
   - composition pattern support, such as split conflict, document zoom, explainer diagram, timeline, governance stack, data value, or final question
4. Generate the image using the approved image provider.
5. Save files as:

```text
output/imagegen/<runId>/scene-1.png
output/imagegen/<runId>/scene-2.png
output/imagegen/<runId>/scene-3.png
output/imagegen/<runId>/scene-4.png
output/imagegen/<runId>/scene-5.png
```

6. Call `autodirector_register_image_assets` with `assetDir`.
7. Submit `imagegen_assets` with prompts, files, style consistency notes, and any rejected images.

## Prompt Standard

Good prompts specify:

- subject and visual metaphor
- foreground/midground/background
- color palette and lighting
- negative constraints
- composition-safe zones for title and subtitle
- composition-safe zones for runtime explanation cards and subtitles
- whether real public-figure likeness is allowed or should use abstract evidence cards
- whether the asset is a hero plate, background plate, package proof, evidence wall, timeline/build plate, or transition bridge
- how the image will behave in the final 9:16 frame: large hero, side-by-side conflict, document crop, diagram center, timeline plate, or transition bridge

For AutoDirector/product-team explainers, generate polished visual plates that support runtime cards:

- bright modern editorial or liquid-glass depth;
- no readable words, logos, watermarks, model names, or tiny fake UI text;
- overlay-safe empty areas;
- varied scene concepts: opening hero, routing/control room, research/story proof, asset wall, timeline/build, render/Quality Gate, delivery package;
- avoid purple AI gradients, dark server rooms, generic dashboards, and funk/phonk club aesthetics unless requested.

## Quality Gate Rejection Rules

Reject your own output before submission if:

- it is mostly blank, dark, muddy, or unreadable
- it contains accidental watermark/labels/UI text
- it is a single giant face without narrative purpose
- it duplicates another scene's composition
- it does not match the script beat
- it cannot support the `visual_composition_plan`
- the subject would appear as a tiny thumbnail after runtime layout
- the aspect ratio is wrong
- it is too busy to hold cards/captions on top

## Artifact Schema

```json
{
  "provider": "codex_imagegen|openai_image_api|user_upload",
  "model": "gpt-image-2",
  "asset_dir": "output/imagegen/<runId>",
  "assets": [
    {
      "scene": 1,
      "file": "scene-1.png",
      "prompt": "...",
      "purpose": "...",
      "safe_zones": "top title / bottom caption",
      "composition_pattern": "split_conflict|document_zoom|explainer_diagram|timeline|governance_stack|data_value|final_question",
      "supports_visual_events": ["event_goal", "event_asset_fallback"],
      "notes": "..."
    }
  ],
  "blocked": false
}
```
