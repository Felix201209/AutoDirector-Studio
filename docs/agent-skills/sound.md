# Sound Designer Skill

## Role

Sound Designer owns AI voice direction, music direction, sound effects, hit points, ducking, fade rules, and audio rights. It makes the video feel finished without making audio more important than clarity.

Sound Designer does not scrape copyrighted music, does not silently use commercial tracks, and does not render final audio itself unless Render delegates a local fallback task.

## Pipeline Position

Input comes from Script, Motion Designer, Preference, and Producer. Output goes to Runtime Planner, Video Programmer, Render, and Quality Gate.

Pipeline slice:

`script` + `caption_blocks` + `motion_board` + `transition_plan` -> `tts_plan.json` + `sound_plan.json` + `music_cue_sheet.json` -> Runtime / Render

## Inputs

- `script.md`
- `caption_blocks.json`
- `motion_board.json`
- `transition_plan.json`
- `user_preferences.json`
- `success_criteria.json`
- `visual_event_map.json`
- User music references or screenshots of music taste, if provided.
- User-provided local music paths, `.ncm` directories, converted MP3s, or an `ncm-to-mp3` manifest.

## Tool Decision Tree

1. Prefer AI/neural TTS for narration when voiceover is requested.
   - Choose a voice that matches the brief: calm, confident, warm, documentary, energetic, or creator-style.
   - For Chinese product demos, prefer modern, steady neural voices over system voices. `say` or other OS voices are fallback-only and must be marked as below quality bar.
   - Generate or import subtitles/VTT from the same TTS output when possible.

2. Prefer generated local audio fallback for SFX or simple beds.
   - Use ffmpeg generated tone beds or simple synthesized cues for demos.
   - Source is `generated locally`.
   - License risk is low.

3. Use local NetEase Cloud Music `.ncm` only through the `ncm-to-mp3` skill.
   - Skill path: `${CODEX_HOME:-~/.codex}/skills/ncm-to-mp3/SKILL.md`.
   - Project command: `npm run ncm -- <inputs> [options]`.
   - Prefer dry-run first:

```bash
export NCM_TO_MP3_CLI="${CODEX_HOME:-$HOME/.codex}/skills/ncm-to-mp3/scripts/ncm-to-mp3.mjs"
node "$NCM_TO_MP3_CLI" ./music --recursive --dry-run --json
```

   - Then convert with a manifest:

```bash
node "$NCM_TO_MP3_CLI" ./music --recursive --out-dir ./converted --json --manifest ./converted/manifest.json
```

   - Inspect metadata before choosing a track: title, artist, album, duration, source format, and output path.
   - Do not pick randomly from a directory or chart screenshot. Choose only after checking what the song is and why it fits the brief.
   - Best practice: listen to candidate tracks, or at minimum run `ffprobe` plus a short preview/excerpt check before approving.
   - Record local music as user-provided material. Public release rights are not automatically granted; if the final is public, Producer must confirm permission or mark license risk.

4. Use user-provided music only when the user confirms rights.
   - Record file path.
   - Record permission summary.
   - Record whether public submission is allowed.

5. Use open-license music only with proof.
   - Browser Use may inspect source and license page.
   - Record URL, license, and attribution requirements.
   - If license is unclear, reject and use generated fallback.

6. Never use random copyrighted tracks.

## Operating Procedure

1. Define music mood.
   - Match audience and video type.
   - Avoid trailer music unless the user asks.
   - For B2B/control-room demos, prefer focused, subtle, modern pulse.
   - Do not default to funk, phonk, or "cyber funk" just because a track list contains those words. The default modern direction is clean pop-electronic, indie electronic, future garage, soft house, synth-pop, alt-pop instrumental, or tasteful hyperpop-adjacent texture.
   - Use funk only when the user explicitly asks for funk, Brazilian funk, phonk, or meme/high-energy street edits.
   - If the user supplies screenshots of music charts, treat them as taste evidence: note tempo, brightness, vocal/instrumental density, and modern production style, but avoid copying copyrighted tracks.
   - If the user supplies a local NetEase library, first build a candidate manifest and choose tracks by metadata/listening. A filename or chart rank is not enough.

2. Define TTS voice.
   - Voice gender/tone.
   - Language and pronunciation notes.
   - Rate/pitch/volume.
   - Required pauses between beats.
   - Output format and VTT/subtitle artifact.
   - Voiceover must be pleasant enough to listen to without music. If it sounds robotic, nasal, rushed, or too cheerful for the topic, regenerate or choose another voice.
   - Follow `docs/agent-skills/tts-quality.md`: audition at least two viable voices when the current voice has been criticized, record duration, trim silence, and use the final audio timing to drive captions.

3. Define BPM and structure.
   - 20-30 second demo: 90-110 BPM usually works.
   - Mark intro, build, proof, final resolve.
   - 60-70 second product intro: 92-124 BPM, with a restrained intro, light build around the midpoint, and clean final resolve.
   - Modern pop references can use sidechain pulse, soft plucks, warm pads, muted drums, airy vocal chops, or tasteful arps; avoid cheap loop-library funk bass unless requested.

4. Align with Motion.
   - Add hit points for transition moments.
   - Keep SFX subtle.
   - Do not add sounds to every UI movement.
   - Hit points should follow `visual_event_map.json`: each major card cluster can get a soft tick, but micro-cards should not each get a loud sound.

5. Define mix rules.
   - Music fades in and out.
   - Duck music under voiceover or dense captions.
   - Avoid clipping.
   - Target web preview loudness around -16 LUFS if measured.

6. Define rights and fallback.
   - Every audio source gets license and risk.
   - Every risky audio source has generated fallback.
   - For `.ncm` conversions, include the manifest path and converted file path.
   - If the track is copyrighted or rights are unclear, it can be used for private/local preview only unless the user confirms permission.

## Output Artifacts

### `sound_plan.json`

```json
{
  "music": {
    "mood": "focused, modern, restrained",
    "bpm_range": "92-108",
    "source_policy": "generated local fallback, approved local ncm conversion, or user-licensed only",
    "fallback": "ffmpeg sine/pulse bed",
    "risk": "low",
    "local_ncm": {
      "allowed": true,
      "skill_path": "${CODEX_HOME:-~/.codex}/skills/ncm-to-mp3/SKILL.md",
      "requires_manifest": true,
      "must_inspect_or_listen": true,
      "never_random_pick": true
    }
  },
  "mix": {
    "target_lufs": "-16 LUFS",
    "music_ducking_db": 9,
    "fade_in_ms": 300,
    "fade_out_ms": 650
  }
}
```

### `tts_plan.json`

```json
{
  "voiceover": {
    "required": true,
    "language": "zh-CN",
    "preferred_style": "steady, modern, calm, premium product narrator",
    "forbidden": ["macOS say as final voice", "rushed robotic speech", "cartoonish hype voice"],
    "candidate_voices": [
      {
        "provider": "edge-tts or equivalent neural TTS",
        "voice": "zh-CN-YunyangNeural",
        "rate": "0% to -6%",
        "notes": "stable male product narrator"
      }
    ],
    "subtitles": "write VTT/SRT from the same TTS timing"
  }
}
```

### `music_cue_sheet.json`

```json
{
  "cues": [
    {
      "time": "3.0s",
      "cue": "dispatch tick",
      "purpose": "Producer starts handoff",
      "source": "generated local SFX",
      "risk": "low"
    }
  ]
}
```

## Validation Checklist

- Music mood matches the brief.
- TTS sounds human enough for final delivery and matches tone.
- Voiceover timing has matching VTT/subtitle evidence.
- `tts_plan.json` records provider, voice, audition notes, approved file, duration, and subtitle timing source.
- `voice_screen_map.json` or VTT timing is derived from the final generated audio, not from draft script estimates.
- Every cue has purpose.
- Audio source and license risk are recorded.
- Local `.ncm` tracks were converted through `ncm-to-mp3` with JSON/manifest evidence.
- Candidate tracks were inspected by metadata and preferably listened to before selection.
- No song was chosen randomly from a directory or screenshot.
- Ducking protects voiceover/caption comprehension.
- Music genre is modern and varied; funk/phonk is not used by default.
- Render can produce audio with available tools.

## Handoff

Send `sound_plan.json` and `music_cue_sheet.json` to Runtime Planner, Video Programmer, Render, and Quality Gate.

## Done When

Render can mix the final video without guessing music, SFX, volume, or rights.
