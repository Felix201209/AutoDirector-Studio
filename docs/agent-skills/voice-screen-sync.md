# Voice-Screen Sync Skill

## Role

This skill prevents the common failure where the narrator says one thing, captions show another thing, and the screen is still showing an old card. It owns the timing contract between voiceover, subtitles, visual events, and scene transitions.

Use it for every voiceover-led video, especially short-form explainers, news videos, product intros, and any user feedback like "人声对不上字幕", "讲到啥画面没跟上", "字幕和声音不一致", or "说得多但屏幕没显示".

## Required Inputs

- `script` or `voiceover_blocks`
- `caption_blocks`
- `shotlist` / `visual_event_map`
- TTS audio path, planned TTS provider, or a pending `tts_plan`
- Rendered preview when available

## Core Rule

One spoken semantic unit equals one on-screen semantic unit.

Do not let a 6-second paragraph sit on one unchanged visual. Do not let a caption appear before the voice says it. Do not let the visual change after the phrase has already ended. Captions alone do not satisfy visual support.

## Timing Contract

For each spoken phrase, create a row in `voice_screen_map.json`:

```json
{
  "id": "vsm_03",
  "voice_text": "董事会可以按使命和章程拒绝。",
  "caption_text": "董事会可拒绝",
  "voice_start": 5.12,
  "voice_end": 6.42,
  "caption_start": 5.02,
  "caption_end": 6.55,
  "visual_event_start": 4.95,
  "visual_event_end": 6.55,
  "scene_id": "s04_board",
  "visual_event": "board stack appears; mission and charter chips highlight",
  "component_selector": "[data-event='board-reject']",
  "status": "aligned"
}
```

Rules:

- Caption may lead voice by at most `0.12s`.
- Caption may lag voice by at most `0.18s`.
- Visual event should begin `0.10-0.30s` before the phrase, so the viewer is ready.
- Visual event must remain visible until at least `0.20s` after the phrase ends.
- If a phrase has two clauses, either split it or animate two micro-events inside the same scene.
- If TTS duration changes after regeneration, retime captions and scene events from the audio, not from the old script.

## Alignment Workflow

1. Generate or import TTS audio.
2. Measure real audio duration and silence.
   - Use `ffprobe` for duration.
   - Use `ffmpeg silencedetect` or waveform inspection for leading/trailing silence.
3. Build timing from the actual audio.
   - Best: use TTS word/viseme timestamps if provider supports them.
   - Good: use forced alignment.
   - Acceptable fallback: manually split by phrase length, then verify by preview.
4. Produce `voice_screen_map.json`.
5. Update `caption_blocks.json` from the same timing map.
6. Update `scene_specs` and animation labels from the same timing map.
7. Render a preview and sample frames at each `voice_start + 0.25s`.
8. Quality Gate fails the video if sampled frames do not show the concept being spoken.

## Phrase Splitting Rules

Split long Chinese voiceover into short semantic units:

- Good: `报价不是普通投资。/ 它想换的是控制权。`
- Bad: `2025年2月马斯克报价约974亿美元但这其实不是普通投资而是围绕OpenAI非营利结构和控制权的治理冲突。`

Recommended phrase length:

- 0.8-1.6 seconds per phrase.
- 6-16 Chinese characters for caption text.
- 1 primary visual event per phrase.
- No more than 2 captions visible at once.

## Visual Support Requirements

Each `voice_screen_map` row must name a visible object:

- card
- source strip
- timeline node
- highlighted row
- data bar
- diagram node
- portrait panel
- document crop
- question/final frame

Forbidden visual support:

- "background changes slightly"
- "caption appears"
- "same card remains visible"
- "generic AI image"
- "visual mood supports it"

## Render Validation

Render must create `sync_quality.json`:

```json
{
  "audio_duration": 14.4,
  "caption_count": 8,
  "visual_event_count": 12,
  "samples": [
    {
      "time": 5.37,
      "voice_text": "董事会可以按使命和章程拒绝。",
      "expected_visual": "board stack and mission/charter chips",
      "frame_file": "sync-sample-05.37.jpg",
      "pass": true
    }
  ]
}
```

Quality Gate must inspect this file plus the contact sheet. If no sync review exists for a voiced video, Quality Gate blocks.

## Patch Owners

- Bad phrase split -> Script / Director
- Caption timing wrong -> Caption Designer / Programmer
- Visual event missing -> Director / Video Programmer
- TTS pacing changed timing -> Sound / Render
- Sampled frames do not match voice -> Quality Gate blocks and sends patch to the specific owner

## Done When

The video can be watched with sound and the viewer always sees the idea slightly before or exactly when the narrator says it.
