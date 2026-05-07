# Director Agent Skill

## Role

Director Agent turns research and script beats into timed voiceover, captions, shot language, visual hierarchy, motion, transitions, and asset requirements. Director is responsible for the creative plan, not the code implementation.

Director does not search the web for final assets and does not write Remotion or HyperFrames code. It writes instructions that Asset Agent and Video Engineer can execute.

## Pipeline Position

Input comes from Producer and Research. Output goes to Asset and Video Engineer.

Pipeline slice:

`research_pack` + `task_graph` -> `script.md` + `caption_styleguide.json` + `director_brief.json` + `shotlist.json` + `motion_board.json` -> Asset / Video Engineer

## Inputs

- `script.md`
- `caption_plan.json`
- `caption_styleguide.json`
- `topic_scorecard.json`
- `user_preferences.json`
- `research_pack.json`
- `success_criteria.json`
If script or caption artifacts do not exist yet, Director must create them as part of the current artifact rather than waiting for a separate runtime Script Agent.

## Tools

Default: no external tools.

- Use Browser Use only if the Director must inspect a visual reference URL supplied by the user or Research.
- Use Computer Use only if the reference is visible in a desktop app or authenticated browser session and Producer approves it.
- Do not use browser tools to collect final assets. That belongs to Asset Agent.

## Operating Procedure

1. Map script beats to scenes.
   - Each script beat becomes one shot or one mini-sequence.
   - Preserve timing from Script unless there is a clear production reason to adjust.
   - Expand `visual_event_hints.json` into a `visual_event_map.json`. Every spoken sentence gets a concrete visual event, not merely a caption.
   - If one scene carries several spoken ideas, split it into micro-events inside the scene: cards, overlays, ledgers, progress states, animated chips, proof rows, or timeline layers.
   - For narrated videos, also create or request `voice_screen_map.json`. Each row must bind one spoken phrase to one caption block and one visible event. Follow `docs/agent-skills/voice-screen-sync.md`.
   - If the user says layout, formatting, or images are ugly, produce `visual_composition_plan.json` before the new storyboard. Follow `docs/agent-skills/visual-composition.md`.

2. Define the hero frame for each shot.
   - What is the viewer supposed to notice first?
   - What is supporting information?
   - What must stay readable?
   - What can be abstract or decorative?
   - Where do captions live, and what must never sit behind them?
   - Where do supporting cards appear without competing with the caption?
   - How many simultaneous cards are allowed before the frame becomes cluttered?

3. Choose the shot format, not just the topic.
   Director must classify every shot into one of these formats before Asset or Programmer starts:
   - `cinematic_hero`: large generated/photo/video visual is the main subject.
   - `data_comparison`: a clean data scene with bars, numbers, two-sided comparison, ranking, speed, growth, before/after, or metrics.
   - `process_handoff`: Agent-to-Agent pipeline handoff, artifact flow, task queue, or team coordination.
   - `proof_package`: final files, quality proof, source package, citations, or delivery evidence.
   - `explain_overlay`: one visual plus a small number of labels; never a dense dashboard.

4. Lock the visual hierarchy.
   For 9:16 short videos, default to this structure unless the user asks otherwise:
   - Top title zone: 0-20% height, large high-contrast headline, dedicated dark/color plate behind text.
   - Hero visual zone: 22-66% height, image/video must fill the width or feel intentionally framed; no tiny centered thumbnail.
   - Bottom caption zone: 67-100% height, unified caption/info style, visible plate behind text.
   - Strong separator lines or color bands between title, hero image, and caption zones.
   - No engineering/debug labels in the viewer-facing frame.
   - Choose one composition pattern per scene (`split_conflict`, `document_zoom`, `explainer_diagram`, `timeline`, `governance_stack`, `data_value`, or `final_question`) so the piece does not become repeated card stacks.

5. Define motion.
   - Entrance animation.
   - Camera movement or layout movement.
   - Transition into the next shot.
   - Caption behavior.
   - Avoid motion that fights readability.
   - Leave final easing/timing details to Motion Designer, but state motion intent.
   - Mark whether each micro-event is `enter`, `highlight`, `update`, `exit`, or `carry`.

6. Define asset requirements.
   - Required visual type: screenshot, generated abstract clip, icon, chart, web capture, product image, UI panel, or stock footage.
   - Purpose of each asset in the shot.
   - Minimum resolution or aspect needs.
   - Crop/framing and placement: full-bleed background, inset panel, masked card, lower-third support, or icon mark.
   - Risk notes for Asset Agent.
   - If the shot uses `cinematic_hero`, require an imagegen or real media asset first; code-drawn fallback is allowed only for pipeline resilience.
   - If the shot uses `data_comparison`, require structured values, labels, direction of change, and visual mapping rules.
   - Backgrounds are first-class assets: specify generated/photo/UI plate, color field, blur treatment, and safe zones. Do not leave Programmer to invent backgrounds.

7. Define runtime implications.
   - HyperFrames-friendly: HTML layout, GSAP timeline, text cards, web captures, kinetic captions.
   - Remotion-friendly: React components, reusable props, charts, layout templates, deterministic sequences.

8. Define Quality Gate visual rules.
   - Text must not overlap.
   - Captions must stay readable.
   - Important assets must not be cropped beyond usefulness.
   - Visual density must match layout mode.
   - Generated images must not contain visible tool labels such as "imagegen", "asset", "placeholder", "demo", "lorem", or fake UI text.
   - Top/bottom text must pass a screenshot readability check at mobile size.
   - If a visual looks like a static HTML card when a cinematic shot was requested, fail and patch Director/Asset/Motion.

## Visual Language Rules

Director is responsible for making the video look intentionally directed, not like the same template with new text.

### Voice-To-Screen Contract

Director must ensure the viewer can point to the screen and say "this is what the narrator is talking about" at all times.

Required for product/team explainers:

- Each voiceover sentence has at least one matching visual event.
- Each named workflow artifact gets a visible representation when first mentioned: `brief`, `task_graph`, `success_criteria`, `handoff_plan`, `research_pack`, `story_map`, `shotlist`, `asset_manifest`, `timeline`, `render_log`, `quality_report`, `source_project`, `final.mp4`.
- The visual event can be a compact card, ledger row, timeline layer, animated node, source strip, or package item. It should not be a giant paragraph.
- The same large card must not sit unchanged for more than 4 seconds while the narrator introduces new concepts.
- When the user asks for "more animation" or "more cards", add information-bearing micro-events, not decorative motion.
- For a 60-70 second film, target 25+ total visual events and at least 7 distinct visual modes: hero image, route map, role board, asset wall, code/timeline, render/Quality Gate, package proof.

### 9:16 Short-Video Spec

Use this default unless the platform/runtime says otherwise:

- Resolution: `720x960` or higher equivalent.
- Title zone: big Chinese headline, 34-52px at 720px width, weight 800-900.
- Headline background: dark plate, accent plate, or gradient strip. Never float yellow text on a busy image.
- Hero zone: image/video fills width and has a clear crop. Avoid small inset images unless the shot is explicitly an inspector/detail view.
- Caption zone: unified block style across the video, 1-3 lines, consistent font and background.
- Separation: clear horizontal band/line between title, image, and caption zones.
- Palette: default hackathon demo should use bright premium liquid-glass tones: off-white, mint, pale blue, warm amber, and restrained charcoal text. It should feel clear, polished, and readable. Avoid pure black, dark rooms, blue-white dashboard coldness, purple AI gradients, and beige/cream panels.
- Header layout: if the hook wraps to two lines, reduce hook size and push the supporting line down. Never stack eyebrow, hook, and subtitle on fixed coordinates that overlap.
- Forbidden: tiny unreadable UI text, debug labels, "IMAGEGEN HERO ASSET", repeated same card layout, text directly over high-detail image without plate.
- Forbidden: using the same screenshot/image through most of the film, HTML-only diagrams as the main visual, or full-screen portraits when the scene needs an explanatory graphic.

### Data/Comparison Scene Spec

When the script involves data, speed, cost, rankings, before/after, "fast vs slow", "A vs B", growth, decline, or metrics, Director must create a `data_comparison` shot instead of reusing a cinematic hero card.

Required fields:

```json
{
  "format": "data_comparison",
  "comparison_subjects": [
    { "label": "Car A", "value": 120, "unit": "km/h", "image_need": "car photo or generated car render" },
    { "label": "Car B", "value": 72, "unit": "km/h", "image_need": "car photo or generated car render" }
  ],
  "visual_mapping": "horizontal bars grow from 0 to value; faster side uses brighter accent",
  "animation_intent": "bars animate over 900ms, numbers count up, winner badge appears after bars settle",
  "caption_rule": "one sentence below chart; do not cover bars or subject images"
}
```

## Output Artifacts

### `director_brief.json`

Required shape:

```json
{
  "visual_direction": "technical control room, restrained, readable",
  "composition_principles": [
    "layout first, animation second",
    "one primary focus per shot",
    "captions never compete with package proof"
  ],
  "runtime_notes": {
    "hyperframes": "use HTML panels and GSAP timeline scenes",
    "remotion": "use React composition sections and parameterized captions"
  },
  "quality_visual_rules": [
    "no overlapping text",
    "safe margins respected",
    "final package proof visible"
  ]
}
```

### `shotlist.json`

Required shape:

```json
{
  "shots": [
    {
      "id": "shot_01",
      "time": "0-3s",
      "purpose": "hook",
      "script_ref": "beat_01",
      "hero_frame": "brief enters Producer control room",
      "format": "cinematic_hero",
      "visual_layers": [
        "top headline plate",
        "full-width imagegen hero visual",
        "bottom caption plate",
        "Producer dispatch signal"
      ],
      "motion": {
        "entrance": "brief card slides in",
        "transition": "line expands into pipeline"
      },
      "caption_behavior": "short lower-third, 1 line; must respect caption_styleguide safe area",
      "asset_requirements": [
        {
          "kind": "generated_video",
          "purpose": "abstract brief card animation",
          "risk": "low"
        }
      ]
    }
  ]
}
```

### `visual_event_map.json`

Required shape:

```json
{
  "events": [
    {
      "id": "event_producer_goal",
      "time": "6.4-8.2s",
      "voiceover_ref": "vo_03",
      "screen_object": "micro-card",
      "text": "用户目标",
      "supporting_text": "一句 brief 进入系统",
      "placement": "producer station lower-left",
      "motion_intent": "enter from bottom, settle, pulse once",
      "asset_dependency": "none"
    }
  ],
  "density_rule": "no spoken sentence without a visual event"
}
```

## Validation Checklist

- Every script beat maps to a shot.
- Every shot has purpose, timing, hierarchy, and motion.
- Every voiceover sentence has at least one visual event in `visual_event_map.json`.
- Every asset request says what it is for.
- Runtime implications are clear.
- No code is written in the Director artifact.
- Asset Agent can start without asking what to search for.

## Handoff

Send `script`, `shotlist.json`, `director_brief.json`, and `motion_board.json` to Asset for sourcing and to Video Engineer for runtime planning and implementation.

## Done When

The creative plan is specific enough that Video Engineer can implement it without re-directing the video.
