# HyperFrames Runtime Pack

## Use When

- The user wants a polished short video, launch reel, product intro, news explainer, data comparison, or website-based promo.
- The video needs motion design, captions, transitions, audio cues, or image-led storytelling.
- Default to HyperFrames for hackathon demos unless the brief explicitly needs long-term React template reuse.

## Required Workflow

1. `DESIGN.md`
   - Visual identity first: palette, typography, image treatment, plates, motion rules, anti-patterns.
   - No composition HTML is allowed before this exists.

2. `SCRIPT.md`
   - Timed narration and captions.
   - Captions are shorter than voiceover and written for mobile readability.
   - Include sentence-level screen-event hints so Director can map spoken concepts to visible cards or visuals.

3. `STORYBOARD.md`
   - Beat-by-beat creative direction.
   - Includes scene format, asset needs, transition, motion, audio cue, and quality checks.
   - Include a `visual_event_map`: every spoken sentence has an event, timestamp, screen object, and motion intent.

4. Asset mapping
   - Every shot maps to real source media, OAuth imagegen asset, user asset, or explicit blocked reason.
   - Code diagrams are fallback-only and cannot satisfy imagegen requirements.

5. Build
   - Layout before animation.
   - GSAP timelines are deterministic, paused, and registered.
   - Use registry blocks/components where they improve quality, but wire them through valid `data-composition-*` attributes.

6. Validate
   - `npx hyperframes lint`
   - `npx hyperframes validate` when available.
   - `npx hyperframes inspect --samples 15`
   - Render only after layout issues are fixed or documented as intentional overflow.

## Required Source Project

```text
source_project/
  DESIGN.md
  SCRIPT.md
  STORYBOARD.md
  README.md
  index.html
  hyperframes.json
  assets/
  compositions/
  validation/
```

## Visual Standards

- At least five distinct visual moments for a 20-30s video.
- For a 60-70s product/team intro, at least seven distinct scene modes and 20+ meaningful visual events.
- Every voiceover sentence should have a matching visible event; captions alone are not enough.
- Main image/video fills the intended hero zone.
- Title, hero visual, and caption/body are separated by plates, bands, or clear negative space.
- No repeated decorative chips or bullets unless showing a final package UI close-up.
- Data scenes animate values, not static labels.
- Scene transitions are narrative devices, not random fade presets.
- Backgrounds are designed plates with depth and safe zones, not leftover gradients.
- Dense concepts use compact runtime-rendered micro-cards, ledgers, source strips, timeline layers, meters, or package items.
- TTS should be AI/neural and pleasant enough without music; music defaults to modern pop/electronic/indie/soft-house directions, not funk/phonk unless requested.
- Local NetEase `.ncm` music can be used only after the `ncm-to-mp3` workflow creates a manifest and Sound records metadata/listening rationale. HyperFrames projects must reference the converted audio file, not raw `.ncm`.

## Runtime Plan Must Include

```json
{
  "runtime": "hyperframes",
  "project_shape": ["DESIGN.md", "SCRIPT.md", "STORYBOARD.md", "index.html", "assets", "compositions"],
  "scene_specs": [],
  "visual_event_map": [],
  "asset_mapping": [],
  "caption_rules": {},
  "tts_plan": {},
  "audio_cues": [],
  "local_ncm_music": {
    "allowed": false,
    "conversion_manifest": null,
    "converted_music_path": null,
    "selection_rationale": null
  },
  "registry_blocks": [],
  "commands": {
    "lint": "npx hyperframes lint",
    "validate": "npx hyperframes validate",
    "inspect": "npx hyperframes inspect --samples 15",
    "render": "npx hyperframes render --quality high --output final.mp4"
  },
  "quality_gates": []
}
```

## Block Instead Of Faking

Return `status=blocked` if:

- image_generation is required but unavailable;
- source media cannot be licensed or cited;
- HyperFrames CLI cannot lint/inspect and no equivalent evidence exists;
- render fails;
- the implementation would be a generic card deck rather than a video.
- the voiceover cannot be matched to visible screen events.
- premium TTS or acceptable modern music cannot be produced/sourced.
- local `.ncm` music was requested but cannot be converted, inspected, or legally/risk-wise documented.
