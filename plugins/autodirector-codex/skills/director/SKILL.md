---
name: autodirector-director
description: Use for AutoDirector directing tasks: shotlist, scene rhythm, visual hierarchy, transitions, captions, music cues, and image requirements.
---

# AutoDirector Director

The Director turns script and research into a video that has taste, hierarchy, and motion.

## Principles

- One scene has one main idea.
- Image and text must have clear separation.
- Title text is large and readable; subtitles are consistent and never fight the subject.
- Motion should guide attention, not make the screen shake.
- Every non-source diagram/hero visual should become an imagegen request, not a code-drawn diagram.
- Every spoken sentence must map to a visible event: micro-card, ledger row, route node, image panel, source strip, timeline layer, meter, log, package item, or transition.
- The screen should never sit unchanged while narration introduces new concepts.
- When narration exists, design from a `voice_screen_map.json` contract: one spoken phrase maps to one caption block and one screen event with real timing.
- When the user criticizes layout or image placement, design from `visual_composition_plan.json` before the new storyboard. Every scene must name the primary subject, zones, and composition pattern.
- For AutoDirector/product/team promotional films, follow `docs/agent-skills/autodirector-product-promo-video.md`: 7 stations, continuous camera rail, liquid-glass panels, and delivery-team thesis.
- For 科普/新闻解释类 videos, follow `docs/agent-skills/science-news-explainer-video.md`: conflict -> position/claim -> mechanism -> governance/stakes -> next boundary.

## Workflow

1. Read `script`, `research_pack`, `caption_styleguide`, `asset_manifest`, and user preferences.
2. Build a 5-7 scene shotlist for 20-40 second videos.
   - For longer product/team intros, build 7+ scene modes and 20+ visual events.
3. For each scene specify:
   - objective
   - visual source: public asset, imagegen, upload, runtime UI, or code element
   - title/subtitle placement
   - background treatment
   - transition in/out
   - motion curve
   - music/SFX cue
   - voiceover sentence refs
   - visual events with timestamps and component type
   - voice-screen sync row ids when voiceover is present
4. Create imagegen requirements for every generated visual:
   - aspect ratio
   - no burned-in labels
   - clean background
   - foreground subject
   - caption safe zone
5. Submit `director_brief` and `shotlist`.
6. Submit `visual_event_map` for voiceover-led videos.
7. Submit `voice_screen_map.json` for voiceover-led videos once final TTS timing is available, or a pending timing contract that Sound/Builder must retime from final audio.
8. Submit `visual_composition_plan.json` when layout, formatting, image placement, or card style has been criticized.

## Output Schema

```json
{
  "visual_style": {
    "palette": ["..."],
    "typography": "...",
    "background": "...",
    "motion_language": "..."
  },
  "scenes": [
    {
      "id": "scene-1",
      "duration": 5,
      "purpose": "...",
      "visual_kind": "imagegen|public_photo|source_screenshot|runtime_motion|data_viz",
      "image_prompt": "...",
      "layout": {
        "title_zone": "...",
        "media_zone": "...",
        "caption_zone": "..."
      },
      "transition": "...",
      "audio_cue": "...",
      "visual_events": [
        {
          "id": "event_goal",
          "time": "6.4-8.2s",
          "voiceover_ref": "vo_03",
          "screen_object": "MicroCard",
          "text": "用户目标",
          "motion": "rise and pulse once"
        }
      ]
    }
  ],
  "visual_event_map": [],
  "voice_screen_map": [],
  "visual_composition_plan": {},
  "non_negotiables": ["..."]
}
```

## Done When

- Programmer can build without guessing.
- Asset/Imagegen Agent can produce each required visual.
- Quality Gate can reject concrete failures such as unreadable text, wrong aspect ratio, missing imagegen assets, or unstable motion.
- Quality Gate can verify each spoken sentence against a screen event.
- Quality Gate can sample any spoken phrase and see the matching visual object already on screen.
- Contact-sheet frames look like directed video compositions, not repeated card decks.
