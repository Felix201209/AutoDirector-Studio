---
name: autodirector-builder
description: Use for AutoDirector runtime planning and video implementation with Remotion or HyperFrames.
---

# AutoDirector Builder

Builder turns the runtime plan and approved assets into a reproducible video project.

## Runtime Choice

- Remotion: React-based, best for product explainers, charts, reusable templates, code review, and long-term maintenance.
- HyperFrames: HTML/GSAP-based, best for fast editorial motion, title cards, captions, and visual rhythm.

If the user chose another host model or CLI, keep runtime independent. Model choice is not runtime choice.

## Inputs

- `runtime_plan`
- `director_brief`
- `shotlist`
- `caption_blocks`
- `asset_manifest`
- `imagegen_assets`
- `sound_plan`
- `ncm_conversion_manifest` when local NetEase music is used
- `visual_event_map`
- `voice_screen_map`
- `visual_composition_plan`
- `tts_plan`

## Build Rules

- For HyperFrames, create `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, `index.html`, `hyperframes.json`, `assets/`, `compositions/`, and `validation/`.
- For HyperFrames, run `npx hyperframes lint`, `npx hyperframes validate` if available, and `npx hyperframes inspect --samples 15`; block if the evidence is missing.
- Do not use local placeholder diagrams when `imagegen_assets` is required.
- Use the exact registered image files and keep aspect ratio.
- Separate media zone, title zone, and caption zone.
- Avoid continuous jitter/shake unless explicitly directed.
- Keep typography large, high contrast, and stable.
- Captions must be short, usually one or two lines; 1080x1920 caption text must be at least 48px, preferably 52-60px for Chinese.
- Do not add decorative bullet/chip rows in normal storytelling shots. Use one clean caption/body plate.
- Use one coherent palette; avoid muddy all-black scenes.
- Add transitions scene-to-scene, not random element motion.
- Normal videos need at least five distinct visual moments; do not reuse one image or one card layout across the whole piece.
- Implement every `visual_event_map` entry as an actual component or animated state. Captions alone do not satisfy voice-to-screen mapping.
- For narrated videos, implement `voice_screen_map.json`. At each phrase sample time, the matching visual object must be visible and readable; a caption-only match fails.
- Captions, visual event labels, and scene timings must come from final TTS timing evidence (`voice_screen_map`, VTT, SRT, or provider timestamps), not estimated script duration.
- If `visual_composition_plan.json` exists, implement it before adding decorative motion. Respect primary subject, zone, grid, and scene pattern choices instead of improvising another card stack.
- For AutoDirector/product/team promotional films, match `docs/agent-skills/autodirector-product-promo-video.md`: HyperFrames/GSAP, one horizontal camera world, 7 station modes, final TTS/VTT captions, and product proof panels.
- For 科普/新闻解释类 videos, match the v10 reference in `docs/agent-skills/science-news-explainer-video.md`: true vertical output, distinct scene modes, neural TTS evidence, `voice_screen_map`, and `sync_quality`.
- For 60-70s product/team videos, use 20+ meaningful visual events and 7+ scene modes.
- Build reusable primitives for dense explainers: `MicroCard`, `LedgerRow`, `SourceCard`, `LayerCard`, `RenderLogCard`, `ProgressMeter`, and `PackageItem`.
- Keep generated/source backgrounds separate from text/card layers so background motion never shakes readable text.
- Use registry blocks/components when they raise quality, but wire them through valid `data-composition-*` attributes.
- Render scripts must open the preview page once, then advance time with `window.__AUTODIRECTOR__.setTime(t)` before screenshots. Do not call `page.goto(...networkidle)` for every frame.
- Render output must include an audio stream when `sound_plan` or the brief requests narration/music. If TTS is unavailable, block honestly instead of shipping silent video.
- Premium narration must use the approved AI/neural TTS file from `tts_plan`; do not ship OS/system voice fallback.
- If TTS was criticized, the project must include the approved voice file, `tts_plan.json`, audition notes, measured duration, and silence-trim/loudness evidence.
- Music should follow the recorded modern direction and avoid default funk/phonk unless requested.
- If local NetEase `.ncm` music is used, reference only the converted file path from the `ncm-to-mp3` manifest. Never import or embed raw `.ncm`, never choose a track randomly, and block if Sound did not provide metadata/listening rationale.

## Workflow

1. Create or update `runtime_plan.json`.
2. Build the runtime project.
3. Render a preview or final package through AutoDirector.
4. Generate `sync_quality.json` by sampling frames during spoken phrases and recording expected versus visible screen evidence.
5. Submit `video_project` with changed files, render command, asset mapping, sync review, and known limitations.

## Artifact Schema

```json
{
  "runtime": "remotion|hyperframes",
  "entrypoint": "...",
  "files_changed": ["..."],
  "asset_mapping": [
    {
      "scene": "scene-1",
      "source": "output/imagegen/<runId>/scene-1.png",
      "used_in": "..."
    }
  ],
  "render_command": "...",
  "validation": ["lint passed", "preview nonblank", "captions readable"],
  "visual_event_coverage": "all events implemented",
  "voice_screen_sync": "voice_screen_map implemented; sync_quality.json generated",
  "visual_composition_coverage": "visual_composition_plan implemented",
  "audio_mapping": {
    "music_source": "local_ncm",
    "converted_music_path": "...",
    "conversion_manifest": "..."
  }
}
```
