# Design System: AutoDirector Control Room

**Source Reference:** `local-downloads/stitch_autodirector_video_control_room`

## 1. Visual Theme & Atmosphere

AutoDirector uses an editorial control-room interface: dark, focused, terminal-adjacent, and moderately dense. It should feel like an AI video production room where a human operator supervises persistent Agents, artifacts, automation gates, runtime planning, rendering, and automated quality checks. The product surface is the app itself, not a landing page.

The mood is precise, technical, and operational, with warmer production-studio accents so the product does not feel like a generic cold dashboard. Hierarchy comes from columns, borders, compact labels, and status color, not from giant hero typography or decorative cards.

## 2. Color Palette & Roles

- Deep Control Canvas (`#101619`): global application background.
- Docked Surface (`rgba(25, 33, 36, 0.74)`): nav rail, inspector, and primary panels.
- Low Container Surface (`rgba(255, 255, 255, 0.075)`): selected rows, input areas, runtime toggles, and console blocks.
- Raised Container Surface (`rgba(255, 255, 255, 0.12)`): active control backgrounds and progress tracks.
- Highest Container Surface (`rgba(255, 255, 255, 0.19)`): strong selected state, scrollbar thumb, subtle emphasis.
- Structural Border (`rgba(255, 255, 255, 0.15)`): panel boundaries and row separators.
- Muted Outline (`rgba(255, 255, 255, 0.24)`): secondary borders and inactive controls.
- Primary Coral (`#ff6b6b`): primary actions, active system text, high-energy production accents.
- Production Mint (`#4fd1b6`): active Agents, passed quality gates, health indicators.
- Amber Cue (`#ffd166`): timing, media, and delivery proof accents.
- Primary Text (`#f6faf8`): readable foreground.
- Muted Text (`#a9b8b6`): metadata, inactive labels, secondary body.

## 3. Typography Rules

- Interface text uses Inter for readable product UI.
- System labels, data rows, console output, node IDs, and artifact names use SFMono/Consolas-style monospace.
- Labels are compact, uppercase, and usually 10-12px.
- Headings stay restrained; this is an operator console, so no marketing-scale hero type.
- Letter spacing is never negative; status labels may use small positive tracking for machine-like clarity.

## 4. Component Stylings

* **Buttons:** Small, direct, and action-led. Primary buttons use coral fill with dark text; secondary buttons are transparent with a thin structural border. Icon plus text is preferred for actions.
* **Panels:** Dark containers with restrained 8-14px radius, one-pixel borders, and minimal shadow.
* **Rows:** Dense 32-44px operator rows with hover tint and clear selected states.
* **Badges:** Small uppercase or code-like labels with thin borders. Coral means active/selected, mint means healthy/running, red means risk, gray means read-only or optional.
* **Inputs:** Terminal-style dark fields with thin borders and focus rings in coral/mint.
* **Inspector:** Right-side panel with tabs for Agent Detail, Artifacts, Runtime, Quality, and Final. It must expose skill, inbox/outbox, memory, inputs, outputs, done criteria, and patch loop.
* **Video Preview:** Dark framed media surface with native controls, progress track, and final package manifest adjacent to the player.

## 5. Layout Principles

- Desktop uses a four-part app shell: top bar, primary nav rail, contextual side panel, central workspace, and right inspector.
- The central workspace is split by mode: Orchestration for live agent work, Delivery for final video/package review.
- Users only talk to Producer. Other Agents are visible with status, skill, artifacts, and handoff records.
- Information is layered: project/session/runtime on the left, active work in the center, selected-node detail on the right, console/team dock at the bottom.
- Mobile collapses into stacked panels while preserving the same information order.

## Do Not Do

- Do not pile every feature into one undifferentiated dashboard.
- Do not use purple AI gradients, oversized rounded cards, or marketing landing sections inside the app.
- Do not hide agent handoffs behind a single prompt result.
- Do not show a final video without artifact history, citations, quality report, and package manifest.
