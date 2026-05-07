# Visual Composition Skill

## Role

This skill fixes ugly image/card layout. It makes the video look designed instead of assembled from random cards. It owns frame hierarchy, image placement, card density, typography rhythm, safe areas, and visual polish.

Use it whenever the user says the layout, formatting, image placement, cards, or visual style is ugly, cluttered, too static, too template-like, or not matching the voiceover.

## Frame Hierarchy

Every scene must answer:

1. What is the primary visual subject?
2. What is the one information layer the viewer should read?
3. What is the caption/voice support?
4. What changes during the shot?

If a frame has no primary visual subject, it is probably a slide, not a video shot.

## 9:16 Layout Standard

Use this stack unless Director intentionally chooses another scene format:

- Top title zone: 7-18% height.
- Hero/media zone: 20-58% height.
- Explanation/event zone: 58-76% height.
- Caption zone: 78-92% height.
- Bottom safe padding: 5-7% height.

Rules:

- The hero image must feel large and intentional, not like a small thumbnail.
- Captions need a stable plate and must not sit directly on busy imagery.
- Cards should align to a grid. Do not scatter cards randomly.
- Use one dominant card group per scene, not five unrelated boxes.
- Keep title, hero, explanation, and caption visually separated by spacing, bands, or plates.

## Composition Patterns

Choose one pattern per scene:

- `split_conflict`: two sides, center divider, one conflict badge.
- `document_zoom`: source/document hero, 1-2 highlighted rows.
- `explainer_diagram`: large diagram node, 2-4 support chips.
- `timeline`: 3-5 nodes with one active node.
- `governance_stack`: layered ownership/control structure.
- `data_value`: one big number plus one explanation.
- `final_question`: single centered question with calm supporting text.

Do not reuse the same pattern three times in a row unless the repetition is the point.

## Card Rules

Cards must be information-bearing. Decorative cards make the frame look cheap.

Good cards:

- one noun phrase
- one active value
- one source/date strip
- one highlighted claim
- one before/after state

Bad cards:

- long paragraphs
- repeated labels
- internal artifact names
- file names
- random chips under every scene
- cards that duplicate the caption exactly

Card density:

- 12-16 second video: 8-14 meaningful visual events.
- 20-30 second video: 12-20 meaningful visual events.
- Each spoken sentence needs at least one event.
- A still hero can remain, but supporting cards must change with the voice.

## Typography Rules

- At 720px width, headline: 38-56px.
- Body/explainer: 22-30px.
- Caption: 25-34px.
- Use 1-2 font families only.
- Avoid tiny eyebrow stacks and overlapping subheads.
- Chinese line breaks must work without spaces.
- No text may touch another text block; minimum 10px vertical separation after render.

## Image Placement Rules

- Treat imagegen/source images as media, not wallpaper.
- Crop around subject; if the subject is not visible in a contact sheet, the shot fails.
- Avoid dark, low-contrast backgrounds behind dark cards.
- If using portraits, keep them as one side of an argument, not as full-screen decoration.
- If using abstract diagrams, make the diagram central and put runtime text around it.
- Generated images should not contain readable text; runtime renders all text.

## Motion and Transition

Motion should improve comprehension:

- Show the hero first, then the card explaining it.
- Use slide, push, reveal, highlight, count-up, path growth, or card flip.
- Do not shake or zoom an entire rasterized frame containing readable text.
- Text should settle quickly and stay readable.
- Transition out only after the viewer had at least `0.55s` to read the final state.

## Contact Sheet Quality Gate

Render must create a contact sheet with at least 1 frame per second.

Quality Gate should reject if:

- Five sampled frames look like the same layout with different text.
- The image subject is too small.
- Cards and captions compete for the same zone.
- The frame reads as a dark dashboard, generic AI moodboard, or PPT deck.
- Any text is clipped, touching, or visually crowded.
- The viewer cannot tell what changed between two adjacent seconds.

## Output Artifact

Produce `visual_composition_plan.json`:

```json
{
  "scene_formats": [
    {
      "scene_id": "s04",
      "pattern": "governance_stack",
      "primary_subject": "board / mission / charter stack",
      "hero_zone": "20-58%",
      "explanation_events": ["mission chip lights", "charter chip lights"],
      "caption_zone": "78-92%",
      "failure_risk": "too many small cards"
    }
  ],
  "grid": {
    "x_margin": 42,
    "gutters": 16,
    "title_zone": "7-18%",
    "hero_zone": "20-58%",
    "explain_zone": "58-76%",
    "caption_zone": "78-92%"
  }
}
```

## Done When

The contact sheet looks like a sequence of designed video frames, not a shuffled stack of cards.
