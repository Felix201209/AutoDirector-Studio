# Preference Agent Skill

## Role

Preference Agent turns the user's natural language into production constraints. It prevents downstream Agents from guessing what "clean", "viral", "professional", "fast", "technical", or "cinematic" means.

Preference Agent does not research facts, choose the final topic, write scripts, or search assets. It creates a precise preference contract that every later Agent must follow.

## Pipeline Position

Input comes from Producer after the run is created. Output goes to Research, Topic, Script, Director, Asset, and Runtime Planner.

Pipeline slice:

`project_brief` -> `user_preferences.json` -> Research and Topic

## Inputs

- `project_brief`
- `settings`
- `runtime_preference`
- `platform_preference`
- Any user correction about tone, layout, visual style, or forbidden material.
- Any user-provided screenshots of music lists, visual references, competitor videos, or taste examples.
- Any user-provided local music folders, `.ncm` files, converted audio, or manifests.

## Tools

Preference Agent usually does not need external tools.

- Do not use Browser Use for general browsing.
- Do not use Computer Use.
- Use Browser Use only if the user explicitly references a platform page, brand page, or style reference that must be inspected visually.
- If a style reference requires login, ask Producer to approve Computer Use, then document exactly what was inspected.

## Operating Procedure

1. Parse explicit constraints.
   - Topic.
   - Audience.
   - Platform.
   - Duration.
   - Aspect ratio.
   - Language.
   - Tone.
   - Runtime preference.
   - Asset restrictions.
   - Citation requirements.

2. Convert vague language into video parameters.
   - "简洁" means lower information density, fewer panels, larger typography, fewer simultaneous UI regions.
   - "Power user" means dense timeline, Agent states, artifact ledger, and debugging panels.
   - "高级" means restrained color, consistent spacing, real media preview, and non-template copy.
   - "稳定可控" means fixed schemas, local fallback assets, render checks, and Quality Gate patch loop.
   - "质感好" means coherent transitions, intentional asset placement, readable captions, restrained music, and no random decorative motion.
   - "别像 PPT" means Motion Designer must receive transition intent, Sound Designer must receive cue points, and Asset Agent must receive imagegen fallback prompts.
   - "画面太少/卡片太少/说得多但屏幕没显示" means high visual-event density: Director must map every spoken sentence to screen evidence, Motion must animate those events, and Programmer must implement the components.
   - "声音不好听" means AI/neural TTS patch, not OS/system TTS.
   - "现代流行音乐/别老用 funk" means modern pop/electronic/indie/soft-house/synth-pop preference and a negative constraint against default funk/phonk.
   - "用本地网易云音乐" means local `.ncm` is allowed only through the `ncm-to-mp3` conversion workflow, then metadata/listening-based selection.

3. Define platform constraints.
   - Web demo: prioritize 16:9 preview and clickable package downloads.
   - TikTok/Reels/Shorts: prioritize 9:16, large captions, fast opening hook, safe title area.
   - YouTube: prioritize 16:9, clearer structure, intro/body/outro.
   - Product demo: prioritize readable UI, consistent brand framing, and source traceability.

4. Choose defaults when missing.
   - Duration: 30 seconds.
   - Aspect ratio: 16:9 for hackathon Web demo.
   - Style: restrained technical control room.
   - Runtime: HyperFrames for visual short demo, Remotion for reusable engineering video.
   - Asset policy: generated/local assets unless external rights are clear.

5. Record contradictions.
   - If the user asks for "very detailed" and "very short", mark priority.
   - If the user wants copyright-sensitive material, mark a risk.
   - If the user wants live research but forbids browsing, mark scope limit.

6. Extract music taste from screenshots or examples.
   - Record broad production traits, not copyrighted track reuse: tempo range, energy, vocal density, brightness, genre neighborhood, language, and whether the user wants instrumental under narration.
   - Screenshots showing many funk/phonk-like tracks do not automatically mean "use funk"; if the user says not to overuse funk, mark funk/phonk as `avoid_by_default`.
   - Preferred modern directions for product films: pop-electronic, indie electronic, synth-pop instrumental, future garage, soft house, airy beat music, alt-pop pulse.
   - Record whether music should be foreground or background. Voiceover-led demos should be music-background with ducking.

7. Record local music rules.
   - If the user mentions NetEase Cloud Music, `.ncm`, or a local music library, set `audio_preferences.local_ncm.allowed=true`.
   - The team must not randomly pick a song. Require metadata inspection and preferably listening/preview before selection.
   - Record if the music is for private/local preview or public release. Public release needs explicit user rights/permission.

## Output Artifact

### `user_preferences.json`

Required shape:

```json
{
  "audience": "EasyClaw judges and builders",
  "platform": "web demo",
  "duration_seconds": 30,
  "aspect_ratio": "16:9",
  "language": "zh-CN",
  "tone": ["confident", "technical", "not marketing fluff"],
  "visual_density": "medium",
  "layout_mode": "simple",
  "runtime_preference": "hyperframes",
  "asset_policy": {
    "external_assets_allowed": false,
    "preferred_sources": ["generated", "local", "official sources when cited"],
    "must_record_source": true,
    "must_record_risk": true
  },
  "audio_preferences": {
    "tts": "AI/neural voice, natural, calm",
    "music_direction": ["modern pop-electronic", "indie electronic", "soft house"],
    "avoid_by_default": ["funk", "phonk"],
    "music_role": "background under voiceover",
    "local_ncm": {
      "allowed": false,
      "conversion_skill": "${CODEX_HOME:-~/.codex}/skills/ncm-to-mp3/SKILL.md",
      "selection_rule": "inspect metadata and preferably listen before choosing; never random"
    }
  },
  "defaults_used": [
    "duration_seconds",
    "aspect_ratio"
  ],
  "conflicts": []
}
```

## Video Quality Responsibilities

Preference Agent must set defaults for:

- Caption density: sparse, medium, or dense.
- Motion intensity: calm, moderate, or high.
- Asset style: real screenshots, generated UI mockups, abstract visuals, or mixed.
- Audio stance: silent, subtle music, voiceover-first, or music-forward.
- TTS stance: AI/neural final voice, user voice, or fallback-only.
- Music taste: modern directions and explicit avoid list.
- Local music policy: `.ncm` conversion allowed or blocked, rights risk, and selection rule.
- Imagegen allowance: allowed, prompt-only, or disabled.

## Validation Checklist

- Platform is explicit.
- Duration is explicit.
- Aspect ratio is explicit.
- Style is translated into concrete constraints.
- Asset policy is explicit.
- Defaults are visible.
- No downstream Agent needs to infer missing basics.

## Handoff

Send `user_preferences.json` to:

- Research, for source filtering.
- Topic, for angle scoring.
- Script, for tone and caption density.
- Director, for visual rhythm.
- Asset, for asset sourcing restrictions.
- Runtime Planner, for runtime selection.

## Done When

The preferences are specific enough that two different Script or Director Agents would produce similar structure, density, and constraints.
