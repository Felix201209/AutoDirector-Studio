# Quality Gate Skill

## Role

Quality Gate validates the final video and package against Producer's success criteria. Quality Gate does not improve the video creatively; it decides pass/fail and creates precise patch tasks for failures.

Quality Gate is the final gate before user delivery.

## Pipeline Position

Input comes from Render, Producer, Asset, Research, and Video Engineer. Output goes to Producer and Final Package.

Pipeline slice:

`final.mp4` + `render_report` + `asset_manifest` + `citations` + `success_criteria` -> `quality_report.md` + `patch_tasks.json` + final pass/fail decision

In AutoDirector's default pipeline, Quality Gate runs immediately after Render and before Final Package assembly. In that mode, validate the rendered mp4 path from `render_report` plus source/assets/runtime artifacts. Do not fail solely because `final_package.zip`, `citations.md`, or package download links do not exist yet; instead list them as packaging follow-ups for Producer/Render.

## Inputs

- `success_criteria.json`
- `final.mp4`
- `render_report.json`
- `asset_manifest.json`
- `citations.md`
- `runtime_plan.json`
- `sound_plan.json`
- `ncm_conversion_manifest.json` when local NetEase Cloud Music is used
- `source_project.zip`
- `run_log.jsonl`

## Tools

Quality Gate may use local inspection tools and browser preview.

Allowed:

- Shell: `ffprobe`, file existence checks, zip listing, JSON validation.
- Browser Use: open final Web UI, play video preview, verify download links, inspect public demo flow.
- Computer Use: only if the final demo must be verified through the user's live browser or desktop app and Browser Use cannot access it.

Not allowed:

- Open-ended research.
- Picking new assets.
- Rewriting source code except through a patch task assigned to the owner Agent.

## Operating Procedure

1. Check package completeness.
   - `final.mp4` or rendered mp4 from `render_report` when Quality Gate is pre-package.
   - `source_project.zip`
   - `asset_manifest.json`
   - `runtime_plan.json`
   - `script.md`
   - `shotlist.json`
   - `citations.md`
   - `quality_report.md` if this is post-package Quality Gate; otherwise this is the artifact being written.
   - `run_log.jsonl`

2. Check media.
   - Video exists.
   - Duration matches tolerance.
   - File is playable.
   - Resolution and fps match runtime plan or documented fallback.
   - Required video materials are present.
   - Audio track exists or absence is explicitly justified.

3. Check content.
   - Script matches topic.
   - Captions are readable.
   - Captions still tell the story when muted.
   - No obvious text overlap.
   - Transitions feel intentional and do not obscure key content.
   - Music/SFX are audible but do not overpower narration or captions.
   - Visual density matches preference.
   - Final video demonstrates multi-Agent teamwork.
   - Title text is large, crisp, and separated from the hero image.
   - Hero images/videos fill the intended zone and are not tiny centered thumbnails.
   - Bottom text uses one consistent style and remains readable.
   - No internal/debug labels are visible in the viewer-facing frame.
   - Imagegen assets are actually used when the run claims imagegen was used.
   - Data/comparison scenes use dynamic bars/numbers/subject images rather than static text cards.
   - Every spoken sentence has a matching visual event: a card, image panel, route node, source strip, timeline layer, meter, log, or package item.
   - Visual-event density matches duration: 20-30s needs roughly 9-14 meaningful visual events; 60-70s needs 20+.
   - Backgrounds support readability and style; they are not empty generic gradients or busy images behind text.

4. Check sources and assets.
   - Every external fact has citation.
   - Every asset has source, purpose, risk, and fallback.
   - No high-risk asset is silently approved.
   - News/current-event videos have a real `research_pack.json`, not a template note.
   - Public-figure images have source page, license, author/credit, and purpose.
   - If imagegen was requested through OAuth, registered assets must appear in `asset_manifest.imagegenResults` as `oauth_agent_imagegen_artifact` or another explicit provider.

5. Check runtime package.
   - Runtime plan exists.
   - Source project exists.
   - Runtime-specific rules are represented.
   - Build/render limitations are documented.
   - For HyperFrames, `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, `hyperframes.json`, asset mapping, and validation logs exist.
   - `npx hyperframes lint` and `npx hyperframes inspect --samples 15` evidence exists. `validate` must exist or the installed CLI limitation must be documented.

6. Check demo readiness.
   - Web UI can show the run.
   - Download links work.
   - Public demo URL works if required.
   - Code ZIP exists for submission.

7. Decide pass/fail.
   - Pass if all hard criteria are met.
   - If fail, create specific patch tasks.
   - Do not request "redo video" unless the failure is structural.

## TTS and Music Quality Gates

Quality Gate must check audio as a production element, not as an afterthought.

- Fail if premium voiceover uses macOS `say`, robotic system voices, or an obviously unpleasant synthetic voice when AI/neural TTS was requested.
- Fail if voiceover timing does not match captions/VTT or scene changes.
- Fail if a voiced video lacks `voice_screen_map.json`, VTT/SRT timing, or `sync_quality.json`.
- Fail if caption timing was estimated from the script instead of derived from the final TTS audio.
- Fail if TTS has no audition notes after the user criticized voice quality.
- Fail if music covers the narrator, clips, or has no source/generation note.
- Fail if the team defaults to funk/phonk when the user requested broader modern pop taste or supplied screenshots showing varied modern music references.
- Passable modern music directions include pop-electronic, indie electronic, soft house, synth-pop, future garage, alt-pop instrumental, airy beat music, and tasteful cinematic pop pulse.
- Fail if local NetEase `.ncm` is used without the `ncm-to-mp3` workflow, dry-run evidence, conversion manifest, and a converted playable output path.
- Fail if a local music track was chosen by filename, folder order, chart rank, or randomness without metadata inspection or listening notes.
- Fail if the source project references raw `.ncm` files instead of converted audio.
- For public-facing exports, flag local NetEase tracks as user-provided material with rights risk unless Producer recorded explicit permission.

## Patch Task Rules

Patch tasks must be narrow:

```json
{
  "id": "patch_001",
  "owner": "asset",
  "severity": "high",
  "issue": "shot_03 references an external screenshot without source URL",
  "expected_fix": "add source URL, license risk, and generated fallback to asset_manifest",
  "validation": "asset_manifest.assets[shot_03].source is present and risk is not empty"
}
```

Owner mapping:

- Missing or risky asset -> Asset Agent.
- Unsupported claim -> Research or Script.
- Caption too long -> Script.
- Caption layout problem -> Caption Designer or Video Programmer.
- Visual overlap -> Director or Video Programmer.
- Transition/motion problem -> Motion Designer.
- Music/mix/rights problem -> Sound Designer or Render Agent.
- Runtime mismatch -> Video Engineer.
- Build/render failure -> Video Programmer or Render.
- Package missing file -> Render.
- User-facing flow broken -> Producer or Web implementation owner.

## Visual Quality Gates

Quality Gate must fail the video if any of these appear:

- A viewer can see `IMAGEGEN HERO ASSET`, `placeholder`, file paths, model names, or artifact IDs.
- Text appears directly on a busy image without a plate and is hard to read.
- The same layout is repeated for every shot when Director requested different formats.
- A generated image is used as a small decoration instead of the main hero visual.
- Top headline is too small to read on mobile.
- Header text overlaps or touches between eyebrow, headline, hook, and subtitle lines.
- The default demo frame misses the requested bright liquid-glass palette, or drifts into pure black, dark rooms, blue-white dashboard coldness, purple gradients, or beige/cream panels.
- Bottom caption/body text changes style randomly between scenes.
- Hero image, title, and captions blend into one blurry mass with no separator.
- The frame lacks a clear primary visual subject, especially when the user criticized image layout.
- The contact sheet looks like repeated card stacks rather than distinct designed frames.
- Data scenes are static cards when the plan calls for bars, number count-up, or comparisons.
- Music source/license is missing when non-silent music is used.
- The whole screen visibly shakes, shimmers, or jitters because the final rendered card was animated with full-frame zoom/pan.
- Decorative bottom chips/bullets such as `final.mp4`, `Source`, `Quality Gate`, `Brief`, `Task Graph`, or `Start` appear in a normal storytelling shot. These are only allowed in a deliberate final package UI close-up.
- Any caption/body line is clipped at the left or right edge, especially Chinese lines that failed to wrap because they contain no spaces.
- A Musk / Altman / OpenAI conflict video uses the AutoDirector hackathon template scenes or mentions irrelevant package chips instead of the requested news topic.
- A news/current-event video has no source plan or marks allegations as facts.
- Public figure portraits are generated/invented when sourced public imagery was required.
- HyperFrames source is missing DESIGN.md, STORYBOARD.md, or validation evidence.
- The video has fewer than five distinct visual moments for a normal 20-30s deliverable.
- A scene claims imagegen but the visible frame is an HTML/SVG/local diagram.
- The narrator says several specific things while the screen shows only one unchanged card or background.
- The film contains too few information-bearing cards/events for its length.
- There is no `visual_event_map.json` or equivalent trace for a voiceover-led product/team video.
- Backgrounds are generic, empty, or fight the cards/captions instead of providing polished product-film depth.
- TTS/music choices ignore explicit user taste notes.
- Local `.ncm` music is selected randomly, lacks conversion evidence, or has no inspection/listening rationale.

### Visual Patch Owners

- Weak visual hierarchy -> Director.
- Missing or poor imagegen hero -> Asset.
- Text readability/plates -> Caption Designer.
- Repeated/static motion -> Motion Designer.
- Incorrect implementation of zones/transitions/data animation -> Video Programmer.
- Render blur/compression/cropping -> Render Agent.

## Output Artifacts

### `quality_report.md`

Required shape:

```md
# Quality Gate Report

## Status

Passed

## Checks

| Area | Result | Notes |
| --- | --- | --- |
| Final video | Pass | 30s playable mp4 |
| Video materials | Pass | 4 generated clips included |
| Assets | Pass | all sources and risks listed |
| Citations | Pass | source ledger present |
| Runtime plan | Pass | HyperFrames plan included |
| Package | Pass | source, logs, quality report included |
| Visual hierarchy | Pass | title, hero, caption zones are separated |
| Imagegen usage | Pass | generated hero assets are present and visible |
| Debug labels | Pass | no internal labels visible |
| Data motion | Pass | data scenes animate when present |
| Voice-to-screen map | Pass | every spoken sentence has matching screen evidence |
| TTS quality | Pass | AI/neural voice, natural timing, VTT aligned |
| Music direction | Pass | modern music choice documented; no default funk/phonk |
| Local NCM music | Pass | converted with ncm-to-mp3 manifest; selected after metadata/listening review |

## Remaining Risks

- Generated demo uses abstract video materials, not live third-party footage.
```

### `patch_tasks.json`

Required shape:

```json
{
  "status": "none",
  "tasks": []
}
```

## Validation Checklist

- Hard criteria checked.
- Package contents checked.
- Video media checked.
- Asset and citation traceability checked.
- Patch tasks are specific and owner-assigned.
- Final pass/fail decision is justified.

## Handoff

Send `quality_report.md`, `patch_tasks.json`, and final pass/fail status to Producer.

## Done When

Producer can confidently deliver the final package to the user or dispatch a narrow patch loop.
