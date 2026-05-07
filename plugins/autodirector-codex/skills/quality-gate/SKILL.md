---
name: autodirector-quality-gate
description: Use for AutoDirector Quality Gate tasks: inspect rendered video, extract frames, verify imagegen/source assets, captions, motion, audio, and final package completeness.
---

# AutoDirector Quality Gate

Quality Gate protects the product from shipping a bad video.

## Fail Fast Conditions

Fail the run if any of these are true:

- Required imagegen scenes are local HTML/SVG/canvas/raster diagrams.
- The final video uses fewer distinct hero visuals than the shotlist requires.
- Text overlaps, wraps awkwardly, or is unreadable at mobile preview size.
- The scene is mostly dark/muddy without intentional visual reason.
- Motion creates screen shaking or visual instability.
- Audio hums, clips, or drowns the narration.
- Premium narration uses OS/system voice fallback instead of approved AI/neural TTS.
- TTS was criticized but there is no `tts_plan.json`, audition evidence, approved final voice file, measured duration, or silence/loudness check.
- Caption timing was estimated from draft script instead of final TTS audio timing.
- Music defaults to funk/phonk when the user requested modern variety or supplied broader music references.
- Local NetEase `.ncm` music is used without `ncm-to-mp3` dry-run/conversion manifest evidence.
- Local music was chosen randomly, by filename alone, or without metadata/listening notes.
- The source project references raw `.ncm` instead of converted playable audio.
- A public/source image is used without source and risk note.
- HyperFrames source is missing `DESIGN.md`, `STORYBOARD.md`, or lint/inspect evidence.
- The video has fewer than five distinct visual moments for a normal 20-30s deliverable.
- The piece looks like a card deck or dynamic PPT instead of a directed video.
- The narrator says concepts that never appear on screen.
- For voiceover-led videos, `visual_event_map` is missing or not implemented.
- For voiceover-led videos, `voice_screen_map.json`, VTT/SRT/provider timing, or `sync_quality.json` is missing.
- Sampled frames during spoken phrases show only captions, old cards, or generic background instead of the concept being said.
- The user criticized layout/image placement but there is no `visual_composition_plan.json`.
- Contact-sheet frames still look like repeated card stacks, have no clear primary subject, use tiny thumbnails, or crowd captions/cards into the same zone.
- 60-70s product/team videos have fewer than 20 meaningful visual events or fewer than 7 scene modes.
- AutoDirector/product/team promotional films fail if they do not meet `docs/agent-skills/autodirector-product-promo-video.md`: continuous camera rail, 7 station modes, product proof panels, final TTS/VTT timing, and delivery-package ending.
- 科普/新闻解释类 videos fail if they do not meet `docs/agent-skills/science-news-explainer-video.md`: true vertical format, clear mechanism explanation, neural TTS provenance, voice-screen sync, and contact-sheet variety.

## Workflow

1. Read `final_package`, `render_report`, `asset_manifest`, `imagegen_assets`, and `shotlist`.
2. Inspect the video by extracting frames at scene boundaries.
3. Compare each frame to its scene purpose:
   - visual kind matches requirement
   - image fills intended media zone
   - title/subtitle are readable
   - background has depth but does not muddy the content
   - transitions do not cause jitter
   - visual event appears when the corresponding voiceover/caption is active
   - the primary image/subject is visible and large enough to read in the contact sheet
   - captions, cards, and image zones do not compete or overlap
4. Check final package files:
   - `final.mp4`
   - source project
   - asset manifest
   - citations/licenses
   - quality report
   - run logs
5. Submit `quality_report`.
6. If failed, create narrow `patch_tasks` assigned to the responsible Agent. Do not restart the full pipeline unless the brief changed.

## Quality Gate Report Schema

```json
{
  "status": "passed|failed",
  "score": 0,
  "frame_checks": [
    {
      "time": "00:06",
      "scene": "scene-2",
      "result": "pass|fail",
      "issue": "...",
      "patch_owner": "director|visual-imagegen|builder|sound|caption"
    }
  ],
  "asset_checks": [],
  "audio_checks": [
    {
      "tts_quality": "pass|fail",
      "music_direction": "pass|fail",
      "ducking": "pass|fail",
      "local_ncm_manifest": "pass|fail|not_applicable",
      "local_ncm_selection": "pass|fail|not_applicable",
      "tts_plan": "pass|fail",
      "voice_timing_source": "pass|fail"
    }
  ],
  "visual_event_checks": [],
  "voice_screen_sync_checks": [],
  "visual_composition_checks": [],
  "package_checks": [],
  "patch_tasks": [
    {
      "owner": "...",
      "task": "...",
      "acceptance": "..."
    }
  ]
}
```

## Done When

- Quality Gate explains why the video passed or failed.
- Failures are actionable and assigned.
- The final response never hides blocked imagegen or asset problems.
