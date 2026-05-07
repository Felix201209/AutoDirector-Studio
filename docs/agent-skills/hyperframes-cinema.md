# HyperFrames Cinema Standard

## Purpose

This skill prevents AutoDirector Agents from shipping animated slide decks. HyperFrames output must feel like a directed short video: structured story, real visual moments, scene transitions, readable captions, intentional sound, and verified render evidence.

## Hard Gates

1. `DESIGN.md` exists before any composition HTML.
   - It must define palette, typography, image treatment, motion language, caption plates, and explicit anti-patterns.
   - Generic dashboard blue, purple AI gradients, dark muddy rooms, beige cards, and default web app styling are not acceptable unless the brief asks for them. Default AutoDirector demos should be bright, glassy, crisp, and readable.

2. Layout before animation.
   - Every scene must first define its hero frame layout.
   - Use full scene containers with responsive padding/flex/grid.
   - Animate from/to the CSS layout with GSAP; do not guess final positions from offscreen states.

3. At least five distinct visual moments for a 20-30s video.
   - A distinct moment means a different composition idea, not the same card with changed text.
   - Valid moments include sourced footage/photo, OAuth imagegen hero visual, data comparison animation, website capture, product UI capture, package proof, or cinematic transition sequence.
   - For 60-70s product/team films, require at least seven distinct scene modes and 20+ sentence-level visual events.
   - A visual event is information-bearing: a card, ledger row, source strip, timeline layer, progress meter, route node, package item, or Quality Gate check that appears or updates when narration references it.

4. Image policy.
   - Topic-specific explanatory visuals must use OAuth/native `image_generation` or registered user/source assets.
   - Do not use HTML/SVG/canvas/local diagrams as a substitute for imagegen.
   - Do not place one giant face unless the scene purpose is explicitly portrait-led.
   - Public figure identity images must come from real source pages; do not generate fake portraits.

5. Motion policy.
   - Every scene has entrance motion.
   - Every scene boundary has a transition: wipe, mask reveal, match cut, kinetic text bridge, timeline sweep, or controlled crossfade.
   - Avoid full-frame jitter/shake and repeated zoom/fade.
   - Data scenes animate values, bars, counters, subject images, and final deltas.

6. Caption and text policy.
   - Title, hero visual, and caption/body areas must be visibly separated.
   - Text must sit on stable plates or bands when background is busy.
   - Chinese captions must be short enough to wrap cleanly without clipping.
   - No visible debug labels, filenames, model names, tool names, placeholder labels, or artifact IDs.

7. Audio policy.
   - Narration, music, and SFX must be planned with hit points.
   - If music cannot be sourced safely or generated locally, block instead of shipping hum/noise.
   - The final mp4 needs an audio stream unless the user explicitly requested silent output.
   - Final narration should use AI/neural TTS or a user-provided voice. OS/system voices are fallback-only and should not be used for premium delivery.
   - Music should default to modern pop/electronic/indie/soft-house/synth-pop directions. Do not default to funk/phonk unless the brief asks for it.

## Required HyperFrames Project Shape

```text
source_project/
  DESIGN.md
  SCRIPT.md
  STORYBOARD.md
  index.html
  hyperframes.json
  assets/
  compositions/
  validation/
    lint.json
    validate.json
    inspect.json
```

## Required Commands

The Video Engineer or Render Agent must run or honestly block on:

```bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes inspect --samples 15
npx hyperframes render --quality high --output final.mp4
```

If `validate` is not available in the installed HyperFrames version, run `npx hyperframes doctor`, `npx hyperframes lint`, and `npx hyperframes inspect --samples 15`, then record the version limitation.

## Scene Acceptance

Each scene spec must include:

- `scene_id`
- `duration`
- `format`: `cinematic_hero`, `data_comparison`, `website_capture`, `process_handoff`, `proof_package`, or `kinetic_type`
- `hero_frame`
- `asset_id`
- `layout_zones`
- `caption_plate`
- `entrance`
- `transition_out`
- `audio_cue`
- `quality_checks`
- `visual_events`: sentence-level cards/updates with timestamps and purpose
- `background_plate`: generated/source/programmatic layer and safe zones
- `tts_alignment`: related VTT/caption segment or voiceover sentence IDs

## Automatic Fail Conditions

Quality Gate must fail if:

- The video is mostly text cards.
- Fewer than five visual moments are used.
- The same image or same layout carries most of the video.
- Imagegen was required but no generated/source image appears.
- HyperFrames lint/inspect evidence is missing.
- Text overlaps, jitters, clips, or becomes unreadable.
- Music hums, clips, or lacks source/generation notes.
- The final looks unrelated to the user's topic.
- The video uses repeated screenshots or HTML diagrams instead of distinct real/imagegen visual moments.
- The narrator introduces concepts that never appear on screen.
- A one-minute product film contains fewer than 20 meaningful visual events.
- The final voice sounds like a system `say` voice when premium TTS was requested.
- Music defaults to funk/phonk despite no user preference for those genres.
