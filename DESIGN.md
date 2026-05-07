# Design System: AutoDirector Control Room

**Source Reference:** `local-downloads/stitch_autodirector_video_control_room`

## 1. Visual Theme & Atmosphere

AutoDirector uses a Deep Logic Interface: dark, clinical, terminal-adjacent, and high-density. It should feel like an AI video production control room where a human operator supervises persistent Agents, artifacts, automation gates, runtime planning, rendering, and automated quality checks. The product surface is the app itself, not a landing page.

The mood is precise, technical, and operational. Hierarchy comes from columns, borders, uppercase labels, and status color, not from giant hero typography or decorative cards.

## 2. Color Palette & Roles

- Near-black Control Canvas (`#121416`): global application background.
- Docked Chrome Surface (`#16181A`): nav rail, inspector, and primary panels.
- Low Container Surface (`#1A1C1E`): selected rows, input areas, runtime toggles, and console blocks.
- Raised Container Surface (`#282A2C`): active control backgrounds and progress tracks.
- Highest Container Surface (`#333537`): strong selected state, scrollbar thumb, subtle emphasis.
- Structural Border (`#2D2F31`): all panel boundaries and row separators.
- Muted Outline (`#3A494A`): secondary borders and inactive controls.
- Primary Cyan (`#00F5FF`): selected navigation, primary buttons, active artifact, key system text.
- Logic Lime (`#9DDF2E`): active Agents, passed quality gates, health indicators.
- Soft Error Red (`#FFB4AB`): quality-gate risk, blocked tool calls, patch warnings.
- Primary Text (`#E2E2E5`): readable foreground.
- Muted Text (`#9BA1A6`): metadata, inactive labels, secondary body.

## 3. Typography Rules

- Interface text uses Inter for readable product UI.
- System labels, data rows, console output, node IDs, and artifact names use Space Grotesk.
- Labels are compact, uppercase, and usually 10-12px.
- Headings stay restrained; this is an operator console, so no marketing-scale hero type.
- Letter spacing is never negative; status labels may use small positive tracking for machine-like clarity.

## 4. Component Stylings

* **Buttons:** Small, squared, and direct. Primary buttons are cyan filled with dark text; secondary buttons are transparent with a thin structural border. Icon plus text is preferred for actions.
* **Panels:** Flat dark containers with 4-6px radius, one-pixel borders, and no decorative shadows.
* **Rows:** Dense 32-44px operator rows with hover tint and clear selected states.
* **Badges:** Small uppercase or code-like labels with thin borders. Cyan means active/selected, lime means healthy/running, red means risk.
* **Inputs:** Terminal-style dark fields with thin borders and focus rings in cyan.
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
- Do not use warm glassmorphism, purple AI gradients, oversized rounded cards, or marketing landing sections.
- Do not hide agent handoffs behind a single prompt result.
- Do not show a final video without artifact history, citations, quality report, and package manifest.
