# TTS Quality Skill

## Role

This skill makes final narration sound intentional instead of like a system fallback. It owns TTS provider choice, voice auditioning, script adaptation for speech, pronunciation, pacing, silence trimming, retiming, and delivery-quality checks.

Use it when the user asks for AI voice, good voiceover, calm narration, premium TTS, or complains that the TTS sounds bad, rushed, robotic, nasal, mispronounced, or out of sync.

## Quality Bar

Final voiceover must be pleasant enough to listen to without music.

System voices such as macOS `say` are not final-delivery voices. Edge neural voices are acceptable fallback only after auditioning and timing verification. OpenAI Speech / another high-quality neural TTS is preferred when credentials and tools are available.

## Provider Preference

1. OpenAI Speech via `${CODEX_HOME:-~/.codex}/skills/speech/SKILL.md` when `OPENAI_API_KEY` exists.
2. Edge neural TTS only if OpenAI Speech is unavailable, with at least 2 voice auditions.
3. User-provided voice or approved local recording if supplied.
4. Block instead of shipping a poor system voice when user explicitly asked for a good voice.

## Required TTS Artifact

Produce `tts_plan.json` before render:

```json
{
  "provider": "openai_speech",
  "model": "gpt-4o-mini-tts-2025-12-15",
  "voice": "cedar",
  "language": "zh-CN",
  "style": "沉稳、克制、新闻解释感",
  "speed": 1.0,
  "pronunciation_notes": ["OpenAI 读作 Open A I", "AI 读作 A I"],
  "auditions": [
    {
      "voice": "cedar",
      "file": "audio/audition-cedar.mp3",
      "duration": 14.8,
      "notes": "best balance"
    }
  ],
  "approved_file": "audio/voice-final.mp3",
  "subtitle_timing_source": "audio/voice-final.vtt",
  "retime_required": true
}
```

## Script Preparation For TTS

Before generating audio:

- Rewrite dense text into speakable short clauses.
- Insert punctuation where the voice needs pauses.
- Avoid slash-heavy phrases and stacked nouns.
- Add pronunciation notes for product names, English names, acronyms, and numbers.
- Do not force a 15-second script into 10 seconds by increasing speed too much.

Chinese pacing:

- Calm explainer: about 4.2-5.5 Chinese characters per second.
- Fast short video: about 5.5-6.6 Chinese characters per second.
- If the script exceeds this, shorten the script or extend the video. Do not over-speed TTS.

## Audition Workflow

1. Generate at least two short auditions for the first 2-3 sentences.
2. Compare:
   - naturalness
   - emotional fit
   - pronunciation
   - speed
   - breath/silence
   - whether it remains clear under music
3. Pick one voice and generate the full file.
4. Run `ffprobe` to record duration.
5. Run silence trim or detect leading/trailing silence.
6. If timing is off by more than `0.35s`, regenerate with adjusted script or speed.
7. Create VTT/SRT or `voice_screen_map.json` from the final audio.

## Audio Cleanup

Render/Sound must normalize and clean the voice:

- Trim leading silence over `0.12s`.
- Trim trailing silence except final intentional resolve.
- Add 80Hz high-pass for rumble.
- Use light compression only; avoid crushed voice.
- Keep final voice clear at around `-16 LUFS` integrated mix, with true peak below `-1.5 dBTP`.
- Duck music under voice by `8-12 dB`.

## Reject Conditions

Block or regenerate if:

- The voice sounds like `say`, a phone robot, or a meme voice.
- Chinese is rushed or clipped.
- OpenAI / AI / names are mispronounced.
- The voice starts late relative to first visual/caption.
- Caption timing was copied from the script instead of the final audio.
- Music masks consonants.
- The final mix has no voice file provenance.

## Output For Render

Render must receive:

- `voice-final.mp3` or `.wav`
- `tts_plan.json`
- `voice_timing.vtt` or `voice_screen_map.json`
- `loudness_report.json`
- `tts_audition_notes.json`

## Done When

The voice sounds deliberate, the timing comes from the final generated audio, and Quality Gate can reproduce what voice was used and why.
