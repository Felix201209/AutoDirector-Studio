# AutoDirector Product Promo Video Skill

This is the Agent Team version of `~/.agents/skills/autodirector-product-promo-video/SKILL.md`.

Use it for AutoDirector-style product/team promotional films: product intro, agent-team demo, workflow explainer, delivery pipeline film, or any request to recreate the original AutoDirector intro.

## Local Reference

- Source project: `intro-site/hero-video/`
- Composition: `intro-site/hero-video/index.html`
- Design: `intro-site/hero-video/DESIGN.md`
- Script: `intro-site/hero-video/SCRIPT.md`
- Storyboard: `intro-site/hero-video/STORYBOARD.md`
- Final public video: `intro-site/assets/autodirector-intro.mp4`

Reference specs:

- HyperFrames HTML + GSAP.
- `1920x1080`.
- `67.8s`.
- One horizontal `.camera` world about `7600px` wide.
- 7 station sections.
- Bottom glass caption band.
- AI/neural narration + quiet modern music bed.

## Core Idea

Do not make a landing-page hero or slide deck.

Make a smooth control-room walkthrough proving that AutoDirector is a supervised video production team:

1. User goal enters.
2. Producer splits stages and acceptance criteria.
3. Research and Story create factual narrative.
4. Asset creates purposeful visuals.
5. Video Engineer builds a real animated timeline.
6. Render and Quality Gate inspect output.
7. Final package lands with source, assets, and Quality Gate.

## Visual Identity

Palette:

- Canvas: `#F7F8F5`
- Ink: `#0B1018`
- Muted: `#5D6775`
- Glass: `rgba(255,255,255,0.68-0.84)`
- Accent blue: `#1677FF`
- Accent cyan: `#35D4C8`
- Accent lime: `#DDEB55`
- Warm glow: `#FFC46A`

Typography:

- `Inter`, system UI, `PingFang SC`.
- Headlines: `70-96px`.
- Section headings: `52-68px`.
- Body: `24-40px`.
- Caption band: `40-46px`.

Style:

- Light liquid-glass.
- Calm premium SaaS / AI production platform.
- Continuous rail walkthrough.
- Clear media panels.
- Stable readable captions.

Avoid:

- PPT stacked text.
- Tiny screenshots.
- Purple AI gradient dominance.
- Fake local diagrams as imagegen replacement.
- Narration without screen evidence.
- macOS `say`.
- Default funk/phonk.

## 7-Station Structure

### 1. Identity Hook

Show:

- AutoDirector mark.
- Big headline.
- Generated hero media panel.
- Self-produced badge.
- Rail waking up.

Purpose: this film was made by the team itself.

### 2. Producer Station

Show:

- Brief card.
- Route map.
- Handoff card.
- Artifact chips.
- Micro-cards: user goal, stage split, success criteria, handoff.
- Product UI screenshot.

Purpose: vague goal becomes task graph and acceptance criteria.

### 3. Research / Story Station

Show:

- Role board: Research, Story Director, Script, Artifact, Patch, Audit.
- Proof strip.
- Source cards.

Purpose: facts become story, risk tags, shot rhythm, audit trail.

### 4. Asset / Imagegen Wall

Show:

- 3 tall generated visual panels.
- 2 storyboard/proof panels.
- Asset notes.
- Ledger rows: purpose, source, fallback.

Purpose: visuals are generated or sourced for a reason.

### 5. Video Engineer Station

Show:

- Build panel.
- Code pane.
- Timeline pane.
- Bars, playhead, render ribbon.
- Layer stack: captions, images, transitions, music.

Purpose: this is a continuous video project, not a template PPT.

### 6. Render + Quality Gate Station

Show:

- Final-frame media proof.
- Quality Gate card.
- Checks list.
- quality meter.
- Render log cards.
- Targeted patch card.

Purpose: render, inspect, and patch concrete failures.

### 7. Delivery Package

Show:

- Package visual.
- Deliverables.
- Supervision cards.
- Final AutoDirector mark.

Deliverables:

- 成片
- 交付包
- assets + citations
- quality report

Promise:

- 可监督
- 可修改
- 可复现
- 可交付

## Script Arc

Use this narrative shape:

1. The film is made by the Agent Team itself.
2. Producer turns goal into tasks.
3. Research and Story turn facts into narrative rhythm.
4. Asset provides real/source/generated visuals with purpose and fallback.
5. Video Engineer uses HyperFrames to build continuous motion.
6. Render and Quality Gate check frames, captions, music, assets, package.
7. Failures become targeted patch tasks.
8. Final delivery includes video, source, asset list, quality report.
9. Product thesis: not one button, but a supervised modifiable delivery team.

## Timing Contract

Use final TTS timing.

Reference duration: `67.8s`.

Reference cue groups:

- `0.1-6.4s`: identity hook.
- `6.4-12.7s`: Producer and task graph.
- `12.7-21.0s`: Research / Story / shot rhythm.
- `21.0-29.3s`: Asset and imagegen purpose.
- `29.3-40.3s`: HyperFrames build timeline.
- `40.3-53.3s`: Render + Quality Gate + patch.
- `53.3-66.7s`: final package and product thesis.

For each cue, create a `voice_screen_map` row with:

- voice text
- caption text
- start/end
- station
- DOM selector
- expected visible object
- GSAP cue time

Captions alone do not count.

## Implementation Rules

Use HyperFrames:

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="67.8" data-width="1920" data-height="1080">
```

Register GSAP:

```js
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
window.__timelines["main"] = tl;
```

Camera stops:

- `x: -260` intro drift.
- `x: -900` Producer.
- `x: -1860` Research/Story.
- `x: -2900` Asset wall.
- `x: -4020` Build.
- `x: -5140` Render/Quality Gate.
- `x: -6260` Package.

Use `sine.inOut` for camera moves.

## Asset Requirements

Need:

- `imagegen-01.png`: opening media engine.
- `imagegen-02.png`: agent routing wall.
- `imagegen-03.png`: final package / production timeline.
- `imagegen-04.png`: editing/composition stage.
- `imagegen-05.png`: delivery proof.
- `control-room.png`: real product UI proof.
- `final-frame.png`: rendered output proof.

Imagegen prompt style:

```text
Bright premium liquid-glass editorial product-film visual for an AI video production platform.
Large clear subject: [specific station subject].
Soft daylight, glass surfaces, clean spatial depth, calm serious SaaS feeling.
No readable text, fake UI labels, logos, or watermarks.
Leave safe zones for runtime cards and captions.
```

## Quality Gates

Quality Gate must fail if:

- It looks like a slide deck.
- Camera is not continuous.
- Generated images are tiny, hidden, or decorative only.
- Any narrator sentence lacks visible evidence.
- Captions are not timed from final TTS.
- Caption band covers main media.
- TTS is `say` or another OS/system voice.
- Music covers narration or defaults to funk/phonk.
- HyperFrames lint/validate/inspect evidence is missing.
- No contact sheet or sync samples exist.

Pass only when:

- 7 station modes are distinct.
- 20+ visual events appear.
- Product proof is visible.
- Delivery package is shown.
- The final thesis lands: supervised, modifiable, stable delivery team.

## Required Outputs

- `DESIGN.md`
- `SCRIPT.md`
- `STORYBOARD.md`
- `index.html`
- `voice_screen_map.json`
- `visual_event_map.json`
- `tts_plan.json`
- `asset_manifest.json`
- `imagegen_prompt_pack.json`
- `music_selection_report.md`
- `runtime_plan.json`
- rendered video
- contact sheet
- sync review
- quality report

## Done When

The source shows a one-to-one chain:

`script line -> TTS/VTT cue -> screen event -> GSAP timing -> rendered frame -> quality evidence`.
