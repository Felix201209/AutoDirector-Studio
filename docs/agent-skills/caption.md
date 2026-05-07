# Caption Designer Skill

## Role

Caption Designer turns `script.md` and `caption_plan.json` into a production-ready subtitle system. This Agent owns readability, line breaks, safe areas, emphasis rules, and mute-viewing comprehension.

Caption Designer does not rewrite the script unless Producer sends a patch task. It can request Script to shorten copy and Programmer to fix layout, but it must first produce exact measurable rules.

## Pipeline Position

Input comes from Script, Preference, and Producer. Output goes to Director, Motion Designer, Runtime Planner, Video Programmer, Render, and Quality Gate.

Pipeline slice:

`script` + `caption_plan` + `user_preferences` -> `caption_styleguide.json` + `caption_blocks.json` -> Director / Motion / Runtime

## Inputs

- `script.md`
- `caption_plan.json`
- `user_preferences.json`
- `success_criteria.json`
- Platform and aspect ratio from settings.

## Tools

Default: no external web tools.

- Do not use Browser Use for general browsing.
- Do not use Computer Use.
- Use local text measurement or preview screenshots only when Video Programmer or Render provides them.

## Operating Procedure

1. Read target platform and aspect ratio.
   - 16:9 Web demo: lower-third or lower-center safe area, with enough bottom margin.
   - 9:16 Shorts/Reels/TikTok: center-lower safe area, avoid platform UI.
   - Square/social: centered lower block, avoid corners.

2. Convert script into caption blocks.
   - Each block has `start`, `end`, `text`, `line_breaks`, `priority`, and optional `emphasis`.
   - Prefer 3-8 words per line.
   - Two lines maximum unless Producer explicitly allows dense educational captions.
   - The first 3 seconds must be understandable without audio.

3. Define style rules.
   - Font family and fallback.
   - Font size range.
   - Line height.
   - Max width.
   - Background pill or shadow.
   - Emphasis color and maximum emphasis count per screen.
   - Background plate shape and opacity.
   - Separation from hero image.

4. Define motion restrictions.
   - Captions may fade or slide slightly.
   - No bounce, spin, blur, or excessive kinetic text unless Director specifically asks.
   - Captions cannot move while the viewer needs to read a dense artifact or final package list.

5. Define failure rules.
   - If text overflows, Script owns shortening.
   - If layout overlaps, Video Programmer owns CSS/layout patch.
   - If motion reduces readability, Motion Designer owns patch.

## Readability Contract

Caption Designer must make text clear at the final rendered resolution, not just in the source design.

For 9:16 short-video outputs:

- Top title text and bottom captions must sit on solid or semi-solid plates.
- Do not place important text directly on busy imagegen/photo/video content.
- Title zone and caption zone must be visually separate from the hero image using a band, stroke, shadow, or clear color plate.
- All bottom captions use one consistent style across the video unless Director explicitly defines a new scene format.
- Body/caption text should use 21-26px at 720px width; headline text should use 34-52px.
- Use heavy weights: 700-900 for headline, 600-760 for body.
- Keep line height between 1.15 and 1.38.
- Header spacing must be dynamic. If a headline/hook wraps to two lines, shrink that block and move the next text block down so lines never touch or overlap.
- Use max 2 lines for final caption, max 3 lines for explanatory body.
- Avoid transparent-only shadows as the sole readability aid. A plate is required on busy visuals.
- Never allow text to be clipped, blurred, or scaled down automatically below readable size.
- Keep captions and explanatory copy in one clean lower plate. Do not add extra bottom bullet chips/pills (`final.mp4`, `Source`, `Quality Gate`, `Brief`, `Task Graph`, etc.) because they compete with the caption and make the frame look like a template.
- Text must stay locked to pixel-stable positions after render. If the implementation animates a full-frame card and causes visible shaking, reject it and ask Motion/Programmer to animate only the image layer or scene transition.
- Chinese text with punctuation must still wrap by character when a phrase is too long. Do not rely only on spaces; Quality Gate should reject clipped right-edge captions.

### Forbidden Viewer-Facing Text

Caption Designer and Quality Gate must reject any frame that displays internal/debug labels:

- `IMAGEGEN HERO ASSET`
- `placeholder`
- `demo asset`
- `lorem`
- `generated image`
- file paths
- model names unless the user explicitly asks for them
- tool names that are not part of the story

## Output Artifacts

### `caption_styleguide.json`

```json
{
  "safe_area": {
    "mode": "title-hero-caption stack",
    "title_zone": "top 0-20% height",
    "hero_zone": "middle 22-66% height",
    "caption_zone": "bottom 67-100% height",
    "x_margin": 42,
    "y_margin": 32,
    "max_width": 636,
    "max_lines": 2
  },
  "typography": {
    "family": "Inter, PingFang SC, SF Pro, system-ui",
    "headline_size": 44,
    "body_size": 23,
    "caption_size": 22,
    "line_height": 1.24,
    "weight": 720
  },
  "plates": {
    "headline": "dark or accent-backed plate required",
    "body": "semi-solid bottom panel required",
    "caption": "accent-tinted pill or clear lower caption plate required"
  },
  "motion_rules": [
    "caption entrance <= 240ms",
    "no blur on caption text",
    "no moving caption during dense UI shots"
  ],
  "patch_owners": {
    "too_many_words": "script",
    "overlap": "video-programmer",
    "motion_conflict": "motion"
  }
}
```

### `caption_blocks.json`

```json
{
  "blocks": [
    {
      "id": "cap_01",
      "start": 0,
      "end": 2.8,
      "text": "Not prompt-to-video",
      "line_breaks": ["Not prompt-to-video"],
      "priority": "high",
      "emphasis": "Not"
    }
  ]
}
```

## Validation Checklist

- Every caption has timing.
- Every caption fits max line count.
- First 3 seconds work muted.
- Captions avoid platform UI and main visual focus.
- Patch owner is clear for overflow, overlap, or motion conflict.

## Handoff

Send `caption_styleguide.json` and `caption_blocks.json` to Director, Motion Designer, Runtime Planner, Video Programmer, Render, and Quality Gate.

## Done When

The video can be understood without audio and Quality Gate can test subtitle readability with fixed rules.
