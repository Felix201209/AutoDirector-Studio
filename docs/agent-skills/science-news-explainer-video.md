# Science / News Explainer Video Skill

This project skill is the AutoDirector Agent Team version of `~/.agents/skills/science-news-explainer-video/SKILL.md`.

Use it for 科普类/新闻解释类 vertical videos: AI governance, lawsuits, tech policy, science, finance, company structure, regulation, market conflict, and any brief asking to "复刻这个科普视频", "讲清楚", "加科普", "不要 PPT", "字幕人声对不上", or "排版难看".

## Production Target

Make a polished vertical editorial explainer, not a dynamic slide deck.

The viewer must understand:

1. What happened?
2. Why are the sides disagreeing?
3. What mechanism explains the conflict?
4. Why does it matter beyond gossip?
5. What should we watch next?

## Default Specs

- Aspect ratio: `9:16`.
- Final resolution: `1080x1920`; preview can be `720x960`.
- FPS: `24` or `30`.
- Short explainer: `12-16s`, 5 scenes, 10-16 visual events.
- Standard explainer: `20-30s`, 7 scenes, 18-28 visual events.
- Runtime: HyperFrames for fast editorial motion; Remotion for reusable chart-heavy systems.

## Current Reference: v10

Use v10 as the reference, not v9:

- Video: `intro-site/assets/musk-altman-agentteam-v10.mp4`
- Poster: `intro-site/assets/musk-altman-agentteam-v10-poster.jpg`
- Package: `intro-site/assets/musk-altman-agentteam-v10-package.zip`
- Evidence: `intro-site/assets/musk-altman-agentteam-v10-evidence/`
- Renderer: `scripts/render-musk-altman-agentteam-v10.mjs`

Reference specs:

- `720x1280`, true vertical, 24 fps.
- `24.5s`, slower and more explanatory than v9.
- 6 composition modes: conflict opener, offer/control lane, board decision stack, OpenAI cost map, governance interpretation map, final timeline.
- Neural TTS from Edge voice `zh-CN-YunyangNeural`; do not use `say`.
- Required evidence: `voice_screen_map.json`, `tts_plan.json`, `visual_composition_plan.json`, `sync_quality.json`, contact sheet, music selection report.
- Delivery page points to v10.

## 5-Scene Formula

| Scene | Duration | Purpose | Composition |
| --- | ---: | --- | --- |
| Hook | 2.0-2.8s | Conflict in one sentence. | `split_conflict` |
| Side A | 2.0-2.8s | One side's claim, framed as a claim. | `claim_ledger` |
| Side B | 2.0-2.8s | Counterclaim or practical constraint. | `resource_map` |
| Mechanism | 2.4-3.2s | Explain governance/science/finance/technical structure. | `mechanism_diagram` |
| Stakes | 2.4-3.2s | Why it matters and what comes next. | `timeline` or `final_question` |

## 6-Scene v10 Formula

Use when the user wants this exact current quality:

| Scene | Purpose | Pattern | Required event |
| --- | --- | --- | --- |
| Conflict opener | "Not gossip, governance conflict." | split portraits + VS badge | both sides visible |
| Offer/control | "Price is not the real target." | big price card + control lane | control node lights after price |
| Board explainer | "Board can reject for mission/charter/risk." | decision stack | mission/charter/risk layers reveal |
| Cost response | "Commercialization funds compute/talent/training." | cost mechanism map | nodes connect to capital |
| Governance | "Who interprets public mission?" | interpretation-rights diagram | center explanation node resolves |
| Next | "Court/regulators may redraw boundary." | timeline | final boundary statement holds |

## Research Rules

- Separate fact, position, interpretation, and unknown.
- Never phrase allegations as findings.
- Use cautious language: "一方主张", "对方反驳称", "争点是", "法庭/监管要判断的是".
- For current topics, verify dates and current status before script lock.

## Script Rules

- Start with the conflict, not background.
- Use short semantic units.
- Chinese voice pace: `4.2-5.5` chars/sec calm, `5.5-6.6` chars/sec fast.
- Captions: 6-16 Chinese characters, 1-2 lines max.
- Each spoken semantic unit must become one visible screen event.
- End with consequence or question, not fake certainty.

## Mandatory Artifacts

Producer must require:

- `research_pack.md`
- `script.md`
- `caption_blocks.json`
- `shotlist.json`
- `visual_event_map.json`
- `voice_screen_map.json`
- `visual_composition_plan.json`
- `imagegen_prompt_pack.json`
- `asset_manifest.json`
- `tts_plan.json`
- `tts_audition_notes.json`
- `sound_plan.json`
- `music_selection_report.md`
- `runtime_plan.json`
- source project
- rendered preview/final video
- `sync_quality.json`
- 1 fps contact sheet
- `quality_report.md`

Missing `voice_screen_map.json`, `visual_composition_plan.json`, or TTS evidence blocks Quality Gate for narrated explainers.

## Voice-Screen Contract

Every row in `voice_screen_map.json` binds:

- `voice_text`
- `caption_text`
- `voice_start`
- `voice_end`
- `caption_start`
- `caption_end`
- `visual_event_start`
- `visual_event_end`
- `component_selector`
- `expected_visual`

Timing rules:

- Caption lead <= `0.12s`.
- Caption lag <= `0.18s`.
- Visual begins `0.10-0.30s` before voice.
- Visual stays `0.20s` after phrase.
- Captions alone do not count as visual evidence.
- If TTS changes, retime from final audio.

## TTS Quality

Follow `docs/agent-skills/tts-quality.md`.

Additional explainer-specific rules:

- Voice should sound calm, serious, modern, and grounded.
- Audition at least two voices when quality is criticized.
- Do not use macOS `say` for final.
- Record provider, voice, duration, silence trim, and subtitle timing source.
- Duck music under voice by `8-12 dB`.

## Music

Choose modern editorial music:

- modern pop instrumental
- soft electronic
- synth-pop bed
- restrained trap pulse
- indie electronic
- light cinematic pulse

Avoid:

- default funk/phonk unless user asked
- meme bass
- cheap synthetic hum
- music that covers consonants

If local NetEase `.ncm` is used, follow `${CODEX_HOME:-~/.codex}/skills/ncm-to-mp3/SKILL.md`, convert first, inspect metadata, listen, and explain selection.

## Visual Style

Target: premium vertical editorial explainer.

Use:

- top metadata rail
- clear title zone
- large hero/media zone
- explanation card/node zone
- stable caption plate
- conflict color coding
- source/date/status chips

Avoid:

- tiny thumbnails
- repeated card stacks
- full-screen paragraphs
- generic AI dashboards
- muddy dark cards
- random chips that duplicate captions

## 9:16 Layout

- Top rail: `0-7%`.
- Title: `7-18%`.
- Hero/media: `18-58%`.
- Explanation/events: `58-76%`.
- Caption: `78-92%`.
- Bottom safe padding: `92-100%`.

At 1080 width:

- Outer margin: `42-56px`.
- Gutter: `18-28px`.
- Title: `56-84px`.
- Body cards: `28-42px`.
- Captions: `38-54px`.

## Composition Patterns

Director must pick one per scene and avoid repeating the same pattern:

- `split_conflict`: two actors/sides with center dispute badge.
- `claim_ledger`: one claim card, source strip, status chip.
- `document_zoom`: source/document crop with highlighted rows.
- `mechanism_diagram`: 3-5 nodes with one active path.
- `timeline`: 3-5 events, one active node.
- `stakes_ring`: center topic plus surrounding stakeholders.
- `final_question`: one large question with slow hold.

## Imagegen Prompt Standard

Every generated plate must specify:

- 9:16 premium editorial explainer plate.
- Primary subject large enough to read in contact sheet.
- Composition pattern.
- Foreground/midground/background.
- Safe zones for title, cards, captions.
- No readable text, fake UI labels, watermarks, or logos unless approved.

Runtime renders all factual text.

## Motion

Motion should teach:

- title reveal
- card slide-in
- node path growth
- document row glow
- timeline pulse
- contradiction flip
- push into mechanism
- calm final hold

Reject:

- constant shake
- white flash spam
- full-frame zoom on text
- unreadable 0.2s cards

Important ideas stay readable for `1.2s+`; mechanism scenes for `1.6-2.4s`; final question for `1.0s+`.

## Runtime Rules

Video Engineer must:

- Build layout before animation.
- Implement `visual_composition_plan.json`.
- Implement `voice_screen_map.json`.
- Add `data-event` selectors matching voice-screen rows.
- Keep captions in a stable layer.
- Keep media and text layers separate.
- Generate `sync_quality.json` by sampling frames at `voice_start + 0.25s`.
- Generate a 1 fps contact sheet.

Use primitives:

- `TopRail`
- `SceneTag`
- `ConflictPanel`
- `ClaimCard`
- `SourceStrip`
- `MechanismNode`
- `TimelineNode`
- `CaptionPlate`
- `FinalQuestion`

## Quality Gate Fail Conditions

Quality Gate must block if:

- There is no final-audio timing source.
- Captions are timed from draft script.
- A spoken concept appears only in captions, not the screen.
- Contact sheet looks like repeated card stacks.
- Hero subject is tiny or unclear.
- TTS is robotic, rushed, or lacks audition/source evidence.
- Music was chosen randomly or covers voice.
- Factual claims are overconfident.
- `sync_quality.json` or contact sheet is missing.

## Example Pattern

For a Musk vs Altman / OpenAI governance topic, preserve this structure but verify facts:

1. Hook: not a gossip fight, a governance conflict.
2. Side A: mission/back-to-origin claim.
3. Side B: compute/funding/reality response.
4. Mechanism: control, charter, nonprofit/for-profit boundary.
5. Stakes: court/regulation/capital may redraw AI governance.

## Done When

The video works with sound on, still makes sense with sound off, and every major choice can be audited from artifacts.
