# Script Skill

## Role

This is a folded skill used by Story Director, not a standalone runtime Agent.

The script skill writes the timed voiceover, captions, and narrative structure. It turns the selected topic angle into words that can be spoken, displayed, and edited into shots.

The script skill does not browse for new sources, pick final assets, or write visual code. It must bind important claims to Research source IDs.

## Pipeline Position

Input comes from Topic, Research, and Preference. Output goes to Director, Asset, Runtime Planner, Render, and Quality Gate.

Pipeline slice:

`topic_scorecard` + `research_pack` + `user_preferences` -> `script.md` + `caption_plan.json` -> Caption Designer

## Inputs

- `topic_scorecard`
- `title_options`
- `research_pack`
- `user_preferences`
- `success_criteria`

## Tools

Default: no external tools.

- Do not use Browser Use unless Producer asks for a source wording check.
- Do not use Computer Use.
- If a fact is missing, request Research patch instead of inventing it.

## Operating Procedure

1. Read constraints.
   - Duration.
   - Platform.
   - Aspect ratio.
   - Audience.
   - Tone.
   - Caption density.
   - Required claims.

2. Build a beat outline.
   - 4-6 beats for 20-30 seconds.
   - Each beat has duration, purpose, voiceover, caption, and source IDs.
   - Opening beat must land within first 3 seconds.
   - For each spoken sentence, include a `screen_event_hint`: what should appear while that sentence is heard.
   - Avoid compressing three or four concepts into one long sentence unless Director has enough time to show all of them.

3. Write voiceover.
   - Short sentences.
   - Natural spoken rhythm.
   - Avoid dense technical clauses.
   - Do not mention every internal detail if it harms clarity.
   - Prefer sentence boundaries that create visual cue points. Example: "用户只说目标。Producer 拆阶段、质检标准和交接物。" is better than one long clause because the screen can show "用户目标", then "阶段", "质检", "交接物".
   - Mark important nouns that must be visualized: people, artifacts, claims, metrics, tools, deliverables, risks, and actions.

4. Write captions.
   - Captions must be shorter than voiceover.
   - Prefer 3-8 words per caption line.
   - Avoid long URLs or file names in captions.
   - Keep important text away from platform UI safe areas.
   - Mark emphasis words that may receive visual highlight.
   - If a caption cannot fit in two lines, rewrite it before handoff.
   - Captions should summarize; they do not replace visual cards. If a concept matters, it needs both a caption and a corresponding visual event.

5. Bind claims.
   - Any rule, statistic, product claim, or factual statement must reference `source_ids`.
   - Product positioning may reference `project_brief` if it is self-description.

6. Prepare fallback copy.
   - If voiceover is not generated, captions must still tell the story.
   - If video is muted, on-screen text must remain understandable.

## Output Artifacts

### `script.md`

Required shape:

```md
# Script

## Summary

One-sentence explanation of the video.

## Timed Beats

| Time | Purpose | Voiceover | Caption | Source IDs |
| --- | --- | --- | --- | --- |
| 0-3s | Hook | This is not prompt-to-video. | Not prompt-to-video | project_brief |
| 3-8s | Team | A Producer dispatches specialist Agents through artifacts. | Producer dispatches the team | src_01 |

## Notes

- Caption density: medium.
- Tone: confident, technical, no fluff.
- Screen-event density: one visual cue per spoken sentence minimum.
```

### `caption_plan.json`

Required shape:

```json
{
  "duration_seconds": 30,
  "caption_style": {
    "density": "medium",
    "max_words_per_caption": 8,
    "safe_area": "center-lower third, avoid edges"
  },
  "captions": [
    {
      "start": 0,
      "end": 3,
      "text": "Not prompt-to-video",
      "priority": "high"
    }
  ]
}
```

### `visual_event_hints.json`

Required shape:

```json
{
  "events": [
    {
      "sentence_id": "vo_03",
      "time": "6.4-8.2s",
      "spoken_text": "用户只说目标。",
      "screen_event_hint": "show a compact '用户目标 / one-line brief' card entering Producer station",
      "owner": "director"
    },
    {
      "sentence_id": "vo_04",
      "time": "8.2-12.7s",
      "spoken_text": "Producer 把需求拆成阶段、质检标准和交接物。",
      "screen_event_hint": "three cards appear in order: 阶段拆分, 质检标准, 交接物",
      "owner": "director"
    }
  ]
}
```

## Validation Checklist

- Total duration fits target.
- Every beat has a purpose.
- Every spoken sentence has a screen-event hint.
- Captions are readable.
- Claims are traceable.
- Director can convert every beat into a shot.
- No new unsupported facts were introduced.

## Handoff

Send `script.md` and `caption_plan.json` first to Caption Designer. Send source bindings to Quality Gate. Director should consume Caption Designer's `caption_styleguide.json` instead of guessing subtitle placement.

## Done When

The video can be understood from captions alone, and every factual claim can be checked against Research artifacts.
