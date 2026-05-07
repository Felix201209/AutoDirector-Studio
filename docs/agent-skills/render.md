# Render Agent Skill

## Role

Render Agent runs the generated video project, produces preview evidence, exports final media, mixes approved audio, and records reproducible logs.

Render Agent does not rewrite the creative plan. It may make tiny technical fixes only when they are necessary to run the project and do not change the intended video.

## Pipeline Position

Input comes from Video Programmer and Runtime Planner. Output goes to Quality Gate.

Pipeline slice:

`source_project` + `build_notes` -> `render_report.json` + `final.mp4` + preview evidence -> Quality Gate

## Inputs

- `source_project/`
- `build_notes.md`
- `runtime_plan.json`
- `caption_styleguide.json`
- `motion_board.json`
- `sound_plan.json`
- `ncm_conversion_manifest.json` when local NetEase Cloud Music is used
- `asset_manifest.json`
- `success_criteria.json`

## Tools

Render Agent may use local shell tools.

Allowed:

- Shell commands for install, lint, validate, preview, render, ffmpeg, ffprobe, zip inspection.
- `ncm-to-mp3` CLI or `npm run ncm -- ...` only for approved local `.ncm` conversion handoffs.
- Browser Use for opening a local preview URL, inspecting canvas/video output, and taking screenshots.
- Computer Use only if Browser Use cannot inspect the local preview and Producer approves desktop interaction.

Not allowed:

- Open-ended web research.
- Replacing missing assets with unapproved external assets.
- Changing the script or shot direction without a Producer patch task.

## Operating Procedure

1. Prepare environment.
   - Read `build_notes.md`.
   - Confirm runtime and commands.
   - Confirm asset paths exist.
   - If `sound_plan` references local NetEase `.ncm`, verify a dry-run JSON and conversion manifest exist before render. Use the converted `outputPath`; never wire a raw `.ncm` file into the video project.

2. Run validation.
   - HyperFrames: lint, validate, inspect when CLI is available.
   - Remotion: type/build/still-frame/render commands when available.
   - Fallback: run static checks and ffmpeg render checks.

3. Preview visually.
   - Use Browser Use for local preview if available.
   - Check first frame, mid frame, and final frame.
   - Check text visibility and basic framing.
   - Check that captions do not overlap main assets.
   - Check that motion did not crop or hide important visuals.
   - For TTS-backed videos, sample frames around VTT cue boundaries and verify that the matching card/event is visible when the sentence is spoken.
   - For dense product films, generate a contact sheet across the timeline so Quality Gate can quickly see visual-event density.

4. Render media.
   - Export `final.mp4`.
   - Mix audio according to `sound_plan`.
   - If licensed music is unavailable, use the generated local fallback and record it.
   - If local `.ncm` music is approved but not yet converted, run the documented skill workflow:
     `node "$NCM_TO_MP3_CLI" <music-path> --recursive --dry-run --json`, then
     `node "$NCM_TO_MP3_CLI" <music-path> --recursive --out-dir <converted-dir> --json --manifest <manifest.json>`.
   - Confirm the chosen local music track has `status: "ok"`, a playable converted path, metadata or manual inspection notes, and a selection rationale from Sound. If the handoff only says "pick one", block and return to Sound.
   - Confirm duration, codec, and file size.
   - If generated video materials are part of the package, confirm each exists and is playable.
   - Confirm the TTS file used by the source project is the approved AI/neural voice from `tts_plan.json`, not a system voice fallback.
   - Confirm the TTS timing source exists: VTT/SRT, provider word timestamps, or `voice_screen_map.json`.
   - Render `sync_quality.json` by sampling frames during each spoken phrase and recording whether the expected visual event is visible.
   - Confirm music is ducked under voiceover and is not default funk/phonk unless explicitly requested.

5. Record logs.
   - Commands run.
   - Exit codes.
   - Output files.
   - Errors and responsible owner.

6. If render fails.
   - Do not silently rewrite the project.
   - Create a failure report with owner attribution:
     - Missing asset -> Asset Agent.
     - Bad runtime plan -> Runtime Planner.
     - Code error -> Video Programmer.
     - Caption too long -> Script or Programmer depending on cause.

## Output Artifacts

### `render_report.json`

Required shape:

```json
{
  "status": "passed",
  "runtime": "hyperframes",
  "commands": [
    {
      "cmd": "ffprobe final.mp4",
      "exit_code": 0,
      "summary": "duration 30s"
    }
  ],
  "outputs": {
    "final_video": "final.mp4",
    "preview_screenshots": [
      "preview/frame_000.png"
    ],
    "video_assets": [
      "assets/video/brief-board.mp4"
    ],
    "contact_sheet": "preview/contact-sheet.jpg"
  },
  "media_checks": {
    "duration_seconds": 30,
    "playable": true,
      "has_video_track": true,
    "has_audio_track": true,
    "caption_safe_area_passed": true,
    "voice_to_screen_sample_passed": true,
    "audio_mix": "generated local fallback",
    "music_source": "generated|licensed|local_ncm|none",
    "local_ncm_manifest": "converted/manifest.json",
    "local_ncm_track_inspected": true
  },
  "failures": []
}
```

### `run_log.jsonl`

Each line:

```json
{"at":"2026-04-30T00:00:00Z","agent":"render","event":"command","cmd":"ffprobe final.mp4","status":"ok"}
```

## Validation Checklist

- `final.mp4` exists.
- Duration matches success criteria.
- Video is playable.
- Audio track exists or absence is explicitly justified.
- Captions respect safe area.
- TTS voice source and VTT timing are recorded.
- TTS quality evidence exists: provider, voice, audition notes, duration, and silence trim.
- `voice_screen_map.json`, VTT/SRT, or `sync_quality.json` exists for narrated videos.
- Local `.ncm` music, if used, has a conversion manifest, converted output path, metadata/inspection notes, and no raw `.ncm` reference in the source project.
- Sampled frames match the spoken sentence or caption.
- Contact sheet shows enough visual-event density for the duration.
- Required generated video materials exist.
- Source project is included.
- Render logs are reproducible.
- Failures identify responsible upstream Agent.

## Handoff

Send `render_report.json`, `final.mp4`, preview evidence, and run logs to Quality Gate.

## Done When

Quality Gate can validate the media without needing to rerun the render manually.
