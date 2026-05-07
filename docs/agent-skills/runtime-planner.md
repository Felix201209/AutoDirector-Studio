# Runtime Planner Skill

## Role

This is a folded skill used by Video Engineer, not a standalone runtime Agent.

Runtime Planner translates the Director's creative plan and Asset manifest into a technical implementation plan for either HyperFrames or Remotion.

Runtime Planner does not write final scene code. It locks the engineering plan so Video Programmer cannot accidentally redesign the video.

## Pipeline Position

Input comes from Director, Asset, Preference, and Producer. Output goes to Video Programmer and Render.

Pipeline slice:

`shotlist` + `caption_styleguide` + `motion_board` + `asset_manifest` + `sound_plan` + `runtime_decision` -> `runtime_plan.json` + `scene_specs` -> Video Programmer

## Inputs

- `director_brief.json`
- `shotlist.json`
- `caption_styleguide.json`
- `motion_board.json`
- `asset_manifest.json`
- `sound_plan.json`
- `runtime_decision.json`
- `caption_plan.json`
- `success_criteria.json`
- `visual_event_map.json`
- `tts_plan.json`

## Tools

Default: no web or desktop tools.

- Do not use Browser Use for asset discovery. Asset Agent handles that.
- Do not use Computer Use.
- Read runtime pack docs:
  - `docs/runtime-packs/hyperframes-pack.md`
  - `docs/runtime-packs/remotion-pack.md`
- If runtime behavior is uncertain, ask Producer to authorize a technical doc lookup.

## Runtime Selection Rules

Use HyperFrames when:

- The video is short, visual, caption-heavy, or title-card driven.
- Director requests HTML layout, GSAP animation, web captures, or high-motion transitions.
- The demo needs strong visual rhythm quickly.

Use Remotion when:

- The video should be maintainable React code.
- Scenes are data-driven, chart-heavy, or template-like.
- Reusability and deterministic React composition matter more than motion expressiveness.

If user chose a runtime manually, respect it unless it makes the requested video impossible. If changing runtime, return a decision request to Producer.

## Operating Procedure

1. Validate inputs.
   - Shotlist exists.
   - Asset manifest covers every shot.
   - Captions exist.
   - Runtime decision exists.
   - For voiceover-led videos, `visual_event_map.json` exists and every spoken sentence has a planned screen event.
   - For narrated videos, `tts_plan.json` identifies the approved AI/neural voice and subtitle/VTT source.

2. Choose implementation architecture.
   - HyperFrames: single `index.html` or scene modules, CSS layout, GSAP timelines, deterministic registration.
   - Remotion: React composition, component hierarchy, sequences, props, caption data, asset imports.

3. Build scene specs.
   - Scene ID.
   - Duration.
   - Required assets.
   - Visual hierarchy.
   - Caption placement.
   - Animation requirements.
   - Transition plan reference.
   - Audio cue reference.
   - Render checks.
   - Required visual zones and separator treatment.
   - Whether the scene is `cinematic_hero`, `data_comparison`, `process_handoff`, or `proof_package`.
   - Visual events implemented in the scene, with timestamp, object type, component primitive, and motion reference.
   - Background plate layer, safe zones, and whether it is imagegen/source/programmatic.
   - Audio/TTS alignment for scene start/end and cue boundaries.

4. Define validation commands.
   - HyperFrames: `npx hyperframes lint`, `npx hyperframes validate`, `npx hyperframes inspect`.
   - Remotion: `npx remotion studio`, still-frame checks, `npx remotion render` when configured.
   - Local fallback: ffmpeg render check if runtime tool is unavailable.

5. Define patch boundaries.
   - If caption overflow fails, patch Script or Programmer depending on cause.
   - If missing media fails, patch Asset.
   - If visual hierarchy fails, patch Director.
   - If code fails, patch Video Programmer.

## Visual Spec Translation Rules

Runtime Planner must preserve Director's visual format decisions. It cannot flatten every scene into a generic card template.

For each scene spec, include:

- `format`: from Director, e.g. `cinematic_hero` or `data_comparison`.
- `layout_zones`: title, hero/media, caption/info.
- `separator_rules`: exact bands/strokes/color plates between zones.
- `asset_fit`: how image/video fills the hero zone (`cover`, `contain`, `full_bleed`, or `inset`).
- `text_plate_rules`: required background plates for title/body/caption.
- `motion_family`: from Motion Designer.
- `forbidden_overlays`: debug/tool labels that must not render.
- `visual_events`: sentence-level events that must be implemented as visible components.
- `background_plate`: media/source/programmatic layer and safe areas.
- `tts_alignment`: voiceover or VTT references.

### Voice-To-Screen Technical Rules

Runtime Planner must make the voice-to-screen contract implementable:

- Read `docs/agent-skills/voice-screen-sync.md` for narrated videos.
- Require `voice_screen_map.json` before implementation when TTS exists.
- Read `docs/agent-skills/visual-composition.md` when the user criticizes layout, image placement, or card formatting.
- Read `docs/agent-skills/tts-quality.md` when the user criticizes the voice or asks for premium AI TTS.
- Do not pass vague instructions like "show workflow". Convert them into component requirements: `MicroCard`, `LedgerRow`, `SourceCard`, `LayerCard`, `RenderLogCard`, `ProgressMeter`, `PackageItem`, route nodes, or timeline bars.
- For a 60-70s product intro, require 20+ visual events and 7+ scene modes.
- No scene may hold unchanged for more than 4 seconds while the narrator introduces new concepts.
- Text belongs in runtime-rendered components, not baked into imagegen backgrounds.
- Background camera motion must not move text layers.

### Data Scene Technical Rules

If `format` is `data_comparison`, runtime plan must include structured data and animation mappings:

```json
{
  "format": "data_comparison",
  "data": {
    "unit": "km/h",
    "subjects": [
      { "id": "fast_car", "label": "Fast car", "value": 120, "asset_id": "car_fast_image" },
      { "id": "slow_car", "label": "Slow car", "value": 72, "asset_id": "car_slow_image" }
    ]
  },
  "visual_mapping": {
    "chart_type": "horizontal_bar_race",
    "max_value": 140,
    "number_animation": "count_up",
    "bar_animation_ms": 900
  }
}
```

Use Remotion for heavily data-driven videos when maintainability matters; HyperFrames is fine for lightweight data animation with GSAP.

## Output Artifact

### `runtime_plan.json`

Required shape:

```json
{
  "runtime": "hyperframes",
  "reason": "short visual demo with title cards and motion",
  "duration_seconds": 30,
  "resolution": "1280x720",
  "fps": 30,
  "source_project": "source_project/",
  "rules": [
    "create DESIGN.md before composition",
    "layout before animation",
    "register deterministic GSAP timelines"
  ],
  "validation_commands": [
    "npx hyperframes lint",
    "npx hyperframes validate",
    "npx hyperframes inspect"
  ],
  "scenes": [
    {
      "id": "scene_01",
      "shot_id": "shot_01",
      "duration": 3,
      "assets": ["asset_001"],
      "format": "cinematic_hero",
      "implementation": "title plate + full-width hero media zone + bottom caption plate",
      "layout_zones": {
        "title": "0-20%",
        "hero": "22-66%",
        "caption": "67-100%"
      },
      "separator_rules": ["accent band above hero", "accent band below hero"],
      "asset_fit": "cover",
      "caption_ref": "caption_01",
      "motion_ref": "transition_01",
      "visual_events": [
        {
          "id": "event_goal",
          "time": "6.4-8.2s",
          "component": "MicroCard",
          "text": "用户目标",
          "motion_ref": "micro_card_enter"
        }
      ],
      "tts_alignment": ["vo_03"],
      "audio_cue_ref": "cue_01",
      "patch_owner_if_failed": "video-programmer"
    }
  ]
}
```

### `scene_specs/*.json`

Required shape:

```json
{
  "scene_id": "scene_01",
  "layout": {
    "primary_focus": "brief card",
    "safe_area": "64px margin",
    "caption_zone": "lower third"
  },
  "motion": {
    "enter": "card slides up 24px and fades in",
    "exit": "pipeline line wipes right"
  },
  "assets": [
    {
      "asset_id": "asset_001",
      "path": "assets/video/brief-board.mp4",
      "usage": "background or inset video"
    }
  ]
}
```

## Validation Checklist

- Runtime choice is explicit and justified.
- Every shot has a scene spec.
- Every required asset is referenced.
- Every visual event is assigned to a scene and component.
- TTS timing is represented when narration exists.
- Validation commands are listed.
- Patch ownership is clear.
- Video Programmer does not need to make creative decisions.

## Handoff

Send `runtime_plan.json`, `scene_specs`, and runtime pack rules to Video Programmer. Send validation commands to Render.

## Done When

The implementation path is locked and repeatable.
